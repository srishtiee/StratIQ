from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..models import AuditRecord
from ..schemas import AuditRecord as AuditRecordSchema


def _isoformat(value: datetime | None) -> str:
    if value is None:
        return datetime.now(timezone.utc).isoformat()
    return value.isoformat()


def list_audit_records(session: Session) -> list[AuditRecordSchema]:
    records = list(session.scalars(select(AuditRecord).order_by(desc(AuditRecord.created_at)).limit(100)))
    return [
        AuditRecordSchema(
            id=record.id,
            runId=record.run_id,
            approvalId=record.approval_id,
            eventType=record.event_type,  # type: ignore[arg-type]
            actor=record.actor,
            message=record.message,
            createdAt=_isoformat(record.created_at),
            requestId=record.request_id,
            actorId=record.actor_id,
            actorRole=record.actor_role,
            entityType=record.entity_type,
            entityId=record.entity_id,
        )
        for record in records
    ]
