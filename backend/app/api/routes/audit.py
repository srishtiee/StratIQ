"""StratIQ — /api/audit (governance log)"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.schemas import AuditLogResponse

router = APIRouter()

@router.get("/audit", response_model=list[AuditLogResponse])
async def get_audit_logs(
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    where = "WHERE event_type = :event_type" if event_type else ""
    params = {"event_type": event_type, "limit": limit} if event_type else {"limit": limit}
    result = await db.execute(text(f"""
        SELECT id, user_id, event_type, entity_type, entity_id, metadata, created_at
        FROM audit_logs
        {where}
        ORDER BY created_at DESC
        LIMIT :limit
    """), params)
    rows = result.mappings().all()
    return [AuditLogResponse(**dict(r)) for r in rows]
