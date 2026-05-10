from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..auth import Actor
from ..models import Action, Approval, AuditRecord, Customer
from ..schemas import ActionResult, ApprovalActionPayload, ApprovalRequest


def _isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return value.isoformat()

STATE_TRANSITIONS = {
    "pending": {"approve": "approved", "mark_ready": "approved", "reject": "rejected"},
    "approved": {"execute": "executed"},
    "rejected": {},
    "executed": {},
    "cancelled": {},
}


def _approval_to_schema(approval: Approval, customer_name: str) -> ApprovalRequest:
    return ApprovalRequest(
        id=approval.id,
        runId=approval.run_id,
        customerId=approval.customer_id,
        customerName=customer_name,
        actionTitle=approval.action_title,
        owner=approval.owner,
        priority=approval.priority,  # type: ignore[arg-type]
        status=approval.status,  # type: ignore[arg-type]
        rationale=approval.rationale,
        estimatedImpact=approval.estimated_impact,
        dueLabel=approval.due_label,
        createdAt=_isoformat(approval.created_at),
        actorIdCreatedBy=approval.actor_id_created_by,
        approvedBy=approval.approved_by,
        approvedAt=_isoformat(approval.approved_at) if approval.approved_at else None,
        rejectedBy=approval.rejected_by,
        rejectedAt=_isoformat(approval.rejected_at) if approval.rejected_at else None,
        executedBy=approval.executed_by,
        executedAt=_isoformat(approval.executed_at) if approval.executed_at else None,
        rejectionReason=approval.rejection_reason,
    )


def list_approvals(session: Session) -> list[ApprovalRequest]:
    approvals = list(session.scalars(select(Approval).order_by(desc(Approval.created_at))))
    customers = {c.id: c.name for c in session.scalars(select(Customer))}
    return [_approval_to_schema(appr, customers.get(appr.customer_id, appr.customer_id)) for appr in approvals]


def transition_approval(
    session: Session,
    payload: ApprovalActionPayload,
    actor: Actor,
    request_id: str,
) -> ActionResult:
    approval = session.get(Approval, payload.approvalId)
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval not found")

    current = approval.status.lower()
    decision = payload.decision
    next_state = STATE_TRANSITIONS.get(current, {}).get(decision)
    if next_state is None:
        raise HTTPException(status_code=409, detail=f"Invalid transition: {current} -> {decision}")

    now = datetime.now(timezone.utc)
    before_state = {"status": approval.status}
    approval.status = next_state
    if next_state == "approved":
        approval.approved_by = actor.actor_id
        approval.approved_at = now
    elif next_state == "rejected":
        if not payload.reason:
            raise HTTPException(status_code=409, detail="Rejecting requires a reason")
        approval.rejected_by = actor.actor_id
        approval.rejected_at = now
        approval.rejection_reason = payload.reason
    elif next_state == "executed":
        approval.executed_by = actor.actor_id
        approval.executed_at = now

    action = Action(
        id=f"action-{uuid4().hex[:10]}",
        approval_id=approval.id,
        status="executed" if next_state == "executed" else next_state,
        summary=f"Approval moved to {next_state}",
        audit_note=f"{actor.actor_name} ({actor.actor_role}) set approval to {next_state}",
    )
    session.add(action)
    session.add(
        AuditRecord(
            id=f"audit-{uuid4().hex[:10]}",
            run_id=approval.run_id,
            approval_id=approval.id,
            request_id=request_id,
            actor_id=actor.actor_id,
            actor_name=actor.actor_name,
            actor_role=actor.actor_role,
            event_type="action" if next_state == "executed" else "approval",
            entity_type="approval",
            entity_id=approval.id,
            before_state=before_state,
            after_state={"status": next_state},
            actor=actor.actor_name,
            message=f"Approval transition {current} -> {next_state}",
        )
    )
    session.commit()
    session.refresh(action)
    return ActionResult(
        id=action.id,
        approvalId=approval.id,
        status=action.status,  # type: ignore[arg-type]
        summary=action.summary,
        auditNote=action.audit_note,
        executedAt=_isoformat(action.executed_at),
    )
