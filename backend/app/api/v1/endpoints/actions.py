from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from uuid import UUID
from typing import Literal, Any

from app.db.client import get_supabase, fetch_one
from app.services.data.action_executor import execute_action
from app.schemas.actions import tier_for, validate_payload

router = APIRouter()

ActionType = Literal["task", "email_send", "pdf_report", "meeting_ics"]
ActionStatus = Literal["draft", "pending_approval", "approved", "executing", "completed", "rejected", "failed"]
ApprovalTier = Literal["low", "mid", "high"]


class CreateActionRequest(BaseModel):
    org_id: UUID
    user_id: UUID
    type: ActionType
    title: str
    description: str | None = None
    source_module: Literal["people", "retention", "dashboard"] | None = None
    source_entity_type: Literal["employee", "customer"] | None = None
    source_entity_id: UUID | None = None
    query_id: UUID | None = None
    due_date: str | None = None
    priority: Literal["high", "medium", "low"] | None = None
    payload: dict[str, Any] = {}
    approval_tier: ApprovalTier | None = None  # default derived from type


class UpdateActionRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    payload: dict[str, Any] | None = None
    due_date: str | None = None
    priority: Literal["high", "medium", "low"] | None = None


@router.post("/", status_code=201)
async def create_action(body: CreateActionRequest):
    """Create a draft (or pending_approval) action. Payload validated against the type's schema."""
    # Validate payload shape — surface a 422 instead of failing at execute time.
    try:
        validate_payload(body.type, body.payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid payload for {body.type}: {exc}")

    tier = body.approval_tier or tier_for(body.type)
    initial_status = "draft" if tier == "low" else "pending_approval"

    sb = get_supabase()
    row = sb.table("actions").insert({
        "org_id": str(body.org_id),
        "user_id": str(body.user_id),
        "type": body.type,
        "title": body.title,
        "description": body.description,
        "source_module": body.source_module,
        "source_entity_type": body.source_entity_type,
        "source_entity_id": str(body.source_entity_id) if body.source_entity_id else None,
        "query_id": str(body.query_id) if body.query_id else None,
        "due_date": body.due_date,
        "priority": body.priority,
        "payload": body.payload,
        "approval_tier": tier,
        "status": initial_status,
    }).execute()
    return row.data[0]


@router.get("/")
async def list_actions(org_id: UUID, status: ActionStatus | None = None, limit: int = 50):
    sb = get_supabase()
    q = (
        sb.table("actions")
        .select("*")
        .eq("org_id", str(org_id))
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if status:
        q = q.eq("status", status)
    return q.execute().data


@router.get("/{action_id}")
async def get_action(action_id: UUID, org_id: UUID):
    sb = get_supabase()
    action = fetch_one(
        sb.table("actions").select("*")
        .eq("id", str(action_id))
        .eq("org_id", str(org_id))
        .is_("deleted_at", "null")
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return action


@router.patch("/{action_id}")
async def update_action(action_id: UUID, org_id: UUID, body: UpdateActionRequest):
    """Edit a draft or pending_approval action. Locked once approved/executing."""
    sb = get_supabase()
    action = fetch_one(
        sb.table("actions").select("*")
        .eq("id", str(action_id))
        .eq("org_id", str(org_id))
        .is_("deleted_at", "null")
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action["status"] not in ("draft", "pending_approval"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot edit action in status '{action['status']}'",
        )

    updates: dict[str, Any] = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.description is not None:
        updates["description"] = body.description
    if body.due_date is not None:
        updates["due_date"] = body.due_date
    if body.priority is not None:
        updates["priority"] = body.priority
    if body.payload is not None:
        try:
            validate_payload(action["type"], body.payload)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid payload for {action['type']}: {exc}",
            )
        updates["payload"] = body.payload

    if not updates:
        return action

    row = (
        sb.table("actions")
        .update(updates)
        .eq("id", str(action_id))
        .eq("org_id", str(org_id))
        .execute()
    )
    return row.data[0]


@router.post("/{action_id}/execute")
async def execute(action_id: UUID, org_id: UUID, user_id: UUID):
    """Execute an action. Mid/high-tier actions must be 'approved' first; low-tier can run from 'draft'."""
    sb = get_supabase()
    action = fetch_one(
        sb.table("actions").select("*")
        .eq("id", str(action_id))
        .eq("org_id", str(org_id))
        .is_("deleted_at", "null")
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    tier = action.get("approval_tier") or tier_for(action["type"])

    if tier == "low":
        valid_states = ("draft", "approved")
    else:
        # mid/high actions must go through approval
        valid_states = ("approved",)

    if action["status"] not in valid_states:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot execute {tier}-tier action in status '{action['status']}'. "
                f"Approve it first." if tier != "low"
                else f"Cannot execute action in status '{action['status']}'."
            ),
        )

    result = await execute_action(action, user_id=user_id)
    return result


@router.patch("/{action_id}/approve")
async def approve_action(action_id: UUID, org_id: UUID, approved_by: UUID):
    sb = get_supabase()
    row = sb.table("actions").update({
        "status": "approved",
        "approved_by": str(approved_by),
    }).eq("id", str(action_id)).eq("org_id", str(org_id)).execute()
    return row.data[0]


@router.patch("/{action_id}/reject")
async def reject_action(action_id: UUID, org_id: UUID, reason: str = ""):
    sb = get_supabase()
    row = sb.table("actions").update({
        "status": "rejected",
        "rejected_reason": reason,
    }).eq("id", str(action_id)).eq("org_id", str(org_id)).execute()
    return row.data[0]


@router.delete("/{action_id}", status_code=204)
async def delete_action(
    action_id: UUID,
    org_id: UUID,
    user_id: UUID | None = None,
    reason: str = "",
):
    """Soft-delete an action: sets deleted_at and writes an execution_logs entry.

    Blocks while the action is mid-execution. Idempotent: deleting an already-
    deleted row is a no-op (returns 204).
    """
    sb = get_supabase()
    action = fetch_one(
        sb.table("actions").select("status, deleted_at")
        .eq("id", str(action_id))
        .eq("org_id", str(org_id))
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    if action.get("deleted_at"):
        return None  # idempotent
    if action["status"] == "executing":
        raise HTTPException(
            status_code=409,
            detail="Cannot delete an action while it is executing.",
        )

    now = datetime.now(timezone.utc).isoformat()
    sb.table("actions").update({"deleted_at": now}).eq("id", str(action_id)).eq("org_id", str(org_id)).execute()

    sb.table("execution_logs").insert({
        "org_id": str(org_id),
        "action_id": str(action_id),
        "event": "deleted",
        "actor_id": str(user_id) if user_id else None,
        "detail": {"reason": reason} if reason else {},
    }).execute()
    return None
