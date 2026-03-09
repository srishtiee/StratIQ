from fastapi import APIRouter, Query
from uuid import UUID

from app.db.client import get_supabase

router = APIRouter()


@router.get("/customers")
async def list_customers(
    org_id: UUID,
    segment: str | None = None,
    status: str = "active",
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    """Return customers with latest AI-scored churn risk, sorted by churn score descending."""
    sb = get_supabase()
    q = (
        sb.table("customers")
        .select(
            "id, name, segment, tier, arr, renewal_date, csm_id,"
            "latest_churn_score, latest_health_score, latest_revenue_at_risk,"
            "scores_last_updated_at,"
            "user_profiles!csm_id(name)"
        )
        .eq("org_id", str(org_id))
        .eq("status", status)
        .order("latest_churn_score", desc=True)
        .range(offset, offset + limit - 1)
    )
    if segment:
        q = q.eq("segment", segment)

    result = q.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: UUID, org_id: UUID):
    """Return a single customer with full scoring history, AI reasoning, and extracted call note signals."""
    sb = get_supabase()
    customer = (
        sb.table("customers")
        .select(
            "*, "
            "customer_scores(*, created_at), "
            "csm_notes(id, note_type, meeting_date, ai_extracted_signals, created_at), "
            "ai_entity_reasoning(reasoning, score_before, score_after, delta, factors, created_at)"
        )
        .eq("id", str(customer_id))
        .eq("org_id", str(org_id))
        .single()
        .execute()
    )
    return customer.data


@router.get("/summary")
async def retention_summary(org_id: UUID):
    """Aggregate KPIs for the Customer Retention header row."""
    sb = get_supabase()
    rows = (
        sb.table("customers")
        .select("latest_churn_score, latest_health_score, latest_revenue_at_risk, arr")
        .eq("org_id", str(org_id))
        .eq("status", "active")
        .execute()
        .data
    )

    total = len(rows)
    high_churn = sum(1 for r in rows if (r.get("latest_churn_score") or 0) >= 70)
    total_arr = sum(r.get("arr") or 0 for r in rows)
    arr_at_risk = sum(r.get("latest_revenue_at_risk") or 0 for r in rows)
    avg_health = (
        sum(r["latest_health_score"] for r in rows if r.get("latest_health_score")) / total
        if total else 0
    )

    return {
        "total_customers": total,
        "high_churn_count": high_churn,
        "total_arr": total_arr,
        "arr_at_risk": arr_at_risk,
        "avg_health_score": round(avg_health, 1),
    }
