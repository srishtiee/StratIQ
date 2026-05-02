"""StratIQ — /api/action routes (create + approve/reject/defer)"""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import uuid4
from datetime import datetime
from app.db.session import get_db
from app.schemas import ActionCreate, ActionResponse, ApprovalCreate
from app.services.audit_service import log_event

router = APIRouter()


async def _backfill_actions_for_completed_runs(db: AsyncSession) -> None:
    result = await db.execute(text("""
        SELECT
            r.id,
            COALESCE(r.decision_card->>'headline', 'Executive strategy brief') AS title,
            COALESCE(r.decision_card->>'rationale', r.comms_output->>'summary', '') AS rationale,
            COALESCE(r.decision_card->>'action_suggestion', '') AS action_suggestion,
            r.workflow,
            r.question
        FROM runs r
        LEFT JOIN actions a ON a.run_id = r.id
        WHERE r.status = 'complete'
          AND a.id IS NULL
        ORDER BY r.created_at DESC
    """))
    rows = result.mappings().all()
    if not rows:
        return

    now = datetime.utcnow()
    for row in rows:
        description = row["rationale"] or ""
        if row["action_suggestion"]:
            description = f"{description}\n\nRecommended next step: {row['action_suggestion']}".strip()

        await db.execute(text("""
            INSERT INTO actions
              (id, run_id, action_type, title, description,
               target_entity, priority, status, created_at, updated_at)
            VALUES
              (:id, :run_id, 'strategy_brief', :title, :description,
               CAST(:target_entity AS jsonb), 'high', 'pending', :now, :now)
        """), {
            "id": str(uuid4()),
            "run_id": str(row["id"]),
            "title": (row["title"] or "Executive strategy brief")[:200],
            "description": description[:4000],
            "target_entity": json.dumps({
                "type": "run",
                "run_id": str(row["id"]),
                "workflow": row["workflow"],
                "question": row["question"],
            }),
            "now": now,
        })

    await db.commit()


@router.post("/action", response_model=ActionResponse, status_code=201)
async def create_action(payload: ActionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new action proposal derived from an insight."""
    action_id = str(uuid4())
    now = datetime.utcnow()
    await db.execute(text("""
        INSERT INTO actions
          (id, run_id, action_type, title, description,
           target_entity, priority, due_date, status, created_at, updated_at)
        VALUES
          (:id, :run_id, :action_type, :title, :description,
           :target_entity::jsonb, :priority, :due_date, 'pending', :now, :now)
    """), {
        "id": action_id,
        "run_id": str(payload.run_id) if payload.run_id else None,
        "action_type": payload.action_type,
        "title": payload.title,
        "description": payload.description,
        "target_entity": json.dumps(payload.target_entity or {}),
        "priority": payload.priority,
        "due_date": payload.due_date,
        "now": now,
    })
    await db.commit()
    action = await _get_action(action_id, db)
    await log_event(
        db, event_type="action_create",
        entity_type="action", entity_id=action_id,
        metadata={"action_type": payload.action_type, "title": payload.title},
    )
    return action


@router.get("/actions", response_model=list[ActionResponse])
async def list_actions(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List all actions, optionally filtered by status."""
    await _backfill_actions_for_completed_runs(db)
    where = "WHERE status = :status" if status else ""
    params = {"status": status} if status else {}
    result = await db.execute(
        text(f"SELECT * FROM actions {where} ORDER BY created_at DESC LIMIT 100"),
        params
    )
    rows = result.mappings().all()
    return [_map_action(r) for r in rows]


@router.patch("/action/{action_id}", response_model=ActionResponse)
async def update_action(
    action_id: str,
    payload: ApprovalCreate,
    db: AsyncSession = Depends(get_db),
):
    """Approve, reject, or defer an action."""
    # Update action status
    await db.execute(text("""
        UPDATE actions SET status = :status, updated_at = NOW()
        WHERE id = :id
    """), {"status": payload.decision, "id": action_id})

    # Create approval record
    await db.execute(text("""
        INSERT INTO approvals (id, action_id, decision, notes, reviewed_at)
        VALUES (:id, :action_id, :decision, :notes, NOW())
    """), {
        "id": str(uuid4()),
        "action_id": action_id,
        "decision": payload.decision,
        "notes": payload.notes,
    })
    await db.commit()
    action = await _get_action(action_id, db)
    await log_event(
        db, event_type=payload.decision,
        entity_type="action", entity_id=action_id,
        metadata={"notes": payload.notes or ""},
    )
    return action


async def _get_action(action_id: str, db: AsyncSession) -> ActionResponse:
    result = await db.execute(
        text("SELECT * FROM actions WHERE id = :id"), {"id": action_id}
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Action not found")
    return _map_action(row)


def _map_action(row) -> ActionResponse:
    return ActionResponse(
        id=row["id"],
        run_id=row.get("run_id"),
        action_type=row["action_type"],
        title=row["title"],
        description=row.get("description"),
        target_entity=row.get("target_entity") or {},
        status=row["status"],
        priority=row["priority"],
        due_date=row.get("due_date"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
