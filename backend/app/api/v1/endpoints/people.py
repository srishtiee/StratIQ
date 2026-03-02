from fastapi import APIRouter, Query
from uuid import UUID

from app.db.client import get_supabase

router = APIRouter()


@router.get("/employees")
async def list_employees(
    org_id: UUID,
    department: str | None = None,
    status: str = "active",
    limit: int = Query(default=50, le=200),
    offset: int = 0,
):
    """Return employees with latest AI-scored attrition risk, sorted by risk descending."""
    sb = get_supabase()
    q = (
        sb.table("employees")
        .select(
            "id, name, email, department, role, level, location, hire_date, status,"
            "latest_attrition_risk_score, latest_engagement_score, latest_performance_score,"
            "scores_last_updated_at,"
            "compensation(salary, market_benchmark, compa_ratio, last_review_date)"
        )
        .eq("org_id", str(org_id))
        .eq("status", status)
        .order("latest_attrition_risk_score", desc=True)
        .range(offset, offset + limit - 1)
    )
    if department:
        q = q.eq("department", department)

    result = q.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/employees/{employee_id}")
async def get_employee(employee_id: UUID, org_id: UUID):
    """Return a single employee with full scoring history and AI reasoning."""
    sb = get_supabase()
    employee = (
        sb.table("employees")
        .select(
            "*, compensation(*), "
            "employee_scores(*, created_at), "
            "ai_entity_reasoning(reasoning, score_before, score_after, delta, factors, created_at)"
        )
        .eq("id", str(employee_id))
        .eq("org_id", str(org_id))
        .single()
        .execute()
    )
    return employee.data


@router.get("/summary")
async def people_summary(org_id: UUID, department: str | None = None):
    """Aggregate KPIs for the People Intelligence header row."""
    sb = get_supabase()
    q = sb.table("employees").select("latest_attrition_risk_score, latest_engagement_score, department").eq("org_id", str(org_id)).eq("status", "active")
    if department:
        q = q.eq("department", department)
    rows = q.execute().data

    total = len(rows)
    high_risk = sum(1 for r in rows if (r.get("latest_attrition_risk_score") or 0) >= 70)
    avg_engagement = (
        sum(r["latest_engagement_score"] for r in rows if r.get("latest_engagement_score")) / total
        if total else 0
    )
    return {
        "total_employees": total,
        "high_risk_count": high_risk,
        "avg_engagement_score": round(avg_engagement, 1),
    }
