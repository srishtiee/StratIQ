"""
StratIQ — Audit Service
Writes audit events to the audit_logs table.
"""
import json
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text


async def log_event(
    db: AsyncSession,
    event_type: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict | None = None,
    user_id: str | None = None,
) -> None:
    """
    Insert a single audit log record. Fire-and-forget — exceptions are silently
    swallowed so that a logging failure never breaks the main request.
    """
    try:
        await db.execute(text("""
            INSERT INTO audit_logs
              (id, user_id, event_type, entity_type, entity_id, metadata, created_at)
            VALUES
              (:id, :user_id, :event_type, :entity_type, :entity_id, :metadata::jsonb, NOW())
        """), {
            "id":          str(uuid4()),
            "user_id":     user_id,
            "event_type":  event_type,
            "entity_type": entity_type,
            "entity_id":   entity_id,
            "metadata":    json.dumps(metadata or {}),
        })
        await db.commit()
    except Exception:
        # Audit failures must never break business logic
        pass
