"""StratIQ — /api/insights (run history)"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.schemas import RunSummary

router = APIRouter()

@router.get("/insights", response_model=list[RunSummary])
async def list_insights(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated history of Ask runs (decision insights)."""
    result = await db.execute(text("""
        SELECT id, workflow, question, status,
               comms_output->>'summary' AS summary,
               created_at, completed_at
        FROM runs
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """), {"limit": limit, "offset": offset})
    rows = result.mappings().all()
    return [RunSummary(**dict(r)) for r in rows]
