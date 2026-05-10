from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..auth import Actor
from ..models import AuditRecord, Feedback, WorkflowRun
from ..schemas import FeedbackPayload, RecordFeedbackResponse


def _isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return value.isoformat()


def record_feedback(session: Session, payload: FeedbackPayload, actor: Actor, request_id: str) -> RecordFeedbackResponse:
    workflow_run = session.get(WorkflowRun, payload.requestId)
    if workflow_run is None:
        raise HTTPException(status_code=404, detail="Workflow run not found")
    workflow_run.status = "approved" if payload.verdict == "approve" else "needs_review"
    session.add(
        Feedback(
            id=f"feedback-{uuid4().hex[:10]}",
            run_id=workflow_run.id,
            verdict=payload.verdict,
            note=payload.note,
        )
    )
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=workflow_run.id,
            request_id=request_id,
            actor_id=actor.actor_id,
            actor_name=actor.actor_name,
            actor_role=actor.actor_role,
            event_type="feedback",
            entity_type="workflow_run",
            entity_id=workflow_run.id,
            before_state=None,
            after_state={"status": workflow_run.status},
            actor=actor.actor_name,
            message=f"Feedback captured: {payload.verdict}",
        )
    )
    session.commit()
    return RecordFeedbackResponse(
        requestId=payload.requestId,
        verdict=payload.verdict,
        note=payload.note,
        recordedAt=_isoformat(datetime.now(timezone.utc)),
    )
