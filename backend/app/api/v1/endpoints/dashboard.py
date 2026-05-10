from fastapi import APIRouter
from uuid import UUID

from app.db.client import get_supabase
from app.services.ai.morning_brief import get_or_generate_brief

router = APIRouter()


@router.get("/morning-brief")
async def morning_brief(org_id: UUID, user_id: UUID, refresh: bool = False):
    """Return today's morning brief.

    Generates via AI if not already cached for today. Pass ?refresh=true to
    invalidate the cache and regenerate against the latest scores — useful
    after a re-scoring run completes.
    """
    brief = await get_or_generate_brief(org_id=org_id, user_id=user_id, refresh=refresh)
    return {"content": brief}


@router.get("/kpis")
async def kpis(org_id: UUID, period: str | None = None):
    """Return KPI rows for the dashboard header cards."""
    sb = get_supabase()
    q = sb.table("kpis").select("*").eq("org_id", str(org_id)).order("recorded_at", desc=True).limit(100)
    if period:
        q = q.eq("period", period)
    return q.execute().data


@router.get("/kpis/history")
async def kpi_history(org_id: UUID, name: str | None = None):
    """Return historical KPI rows ordered by recorded_at for trend charts."""
    sb = get_supabase()
    q = (
        sb.table("kpis")
        .select("name, value, period, recorded_at")
        .eq("org_id", str(org_id))
        .order("recorded_at", desc=False)
    )
    if name:
        q = q.eq("name", name)
    return q.execute().data


@router.get("/alerts")
async def alerts(org_id: UUID, limit: int = 20):
    """Return unread notifications as the alert feed."""
    sb = get_supabase()
    return (
        sb.table("notifications")
        .select("*")
        .eq("org_id", str(org_id))
        .eq("read", False)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )
