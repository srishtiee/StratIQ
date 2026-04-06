"""
Morning brief generation — cached per user per day in morning_briefs table.
"""

from uuid import UUID
from datetime import datetime, timezone, timedelta
import anthropic

from app.core.config import settings
from app.db.client import get_supabase, fetch_one

_claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_BRIEF_PROMPT = """You are StratIQ, an AI executive assistant. Generate a concise morning brief (5-7 sentences max).

Today's date: {today}
Organization data:

People Intelligence:
- Total active employees: {total_employees}
- High attrition risk (score ≥ 70): {high_risk_employees}
- Avg engagement score: {avg_engagement}
- Latest AI re-scoring trigger: {last_people_trigger}

Customer Retention:
- Total active customers: {total_customers}
- High churn risk (score ≥ 70): {high_churn_customers}
- ARR at risk: ${arr_at_risk:,.0f}
- Avg health score: {avg_health}

Recent alerts/actions:
{recent_context}

Write a crisp morning brief covering: the most urgent people risk, the most urgent customer risk, and one recommended focus for today. Be direct and specific — use real numbers."""


async def get_or_generate_brief(*, org_id: UUID, user_id: UUID) -> str:
    sb = get_supabase()
    today = datetime.now(timezone.utc).date().isoformat()

    # Check cache
    cached = fetch_one(
        sb.table("morning_briefs")
        .select("content")
        .eq("org_id", str(org_id))
        .eq("user_id", str(user_id))
        .gte("generated_at", f"{today}T00:00:00Z")
    )
    if cached:
        return cached["content"]

    # Pull summary data
    employees = sb.table("employees").select("latest_attrition_risk_score, latest_engagement_score").eq("org_id", str(org_id)).eq("status", "active").execute().data
    customers = sb.table("customers").select("latest_churn_score, latest_health_score, latest_revenue_at_risk").eq("org_id", str(org_id)).eq("status", "active").execute().data

    total_emp = len(employees)
    high_risk_emp = sum(1 for e in employees if (e.get("latest_attrition_risk_score") or 0) >= 70)
    avg_eng = sum(e.get("latest_engagement_score") or 0 for e in employees) / max(total_emp, 1)

    total_cust = len(customers)
    high_churn = sum(1 for c in customers if (c.get("latest_churn_score") or 0) >= 70)
    arr_at_risk = sum(c.get("latest_revenue_at_risk") or 0 for c in customers)
    avg_health = sum(c.get("latest_health_score") or 0 for c in customers) / max(total_cust, 1)

    # Last AI run
    last_run = (
        sb.table("ai_analysis_runs")
        .select("module, created_at")
        .eq("org_id", str(org_id))
        .eq("status", "complete")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    last_trigger = last_run[0]["module"] + " re-scored at " + last_run[0]["created_at"][:10] if last_run else "No recent AI scoring"

    # Recent unread notifications
    notifs = (
        sb.table("notifications")
        .select("message")
        .eq("org_id", str(org_id))
        .eq("user_id", str(user_id))
        .eq("read", False)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
        .data
    )
    recent_context = "\n".join(f"- {n['message']}" for n in notifs) if notifs else "No new alerts."

    if settings.mock_ai:
        content = (
            f"[Mock brief — {today}] "
            f"You have {high_risk_emp} employees at high attrition risk out of {total_emp} active, "
            f"with average engagement at {round(avg_eng, 1)}. "
            f"On the retention side, {high_churn} customers are at high churn risk with ${arr_at_risk:,.0f} ARR at risk. "
            "Set MOCK_AI=false to generate a real AI-written brief."
        )
        sb.table("morning_briefs").upsert({
            "org_id": str(org_id),
            "user_id": str(user_id),
            "content": content,
            "brief_date": today,
            "valid_until": end_of_day,
        }, on_conflict="org_id,user_id,brief_date").execute()
        return content

    prompt = _BRIEF_PROMPT.format(
        today=today,
        total_employees=total_emp,
        high_risk_employees=high_risk_emp,
        avg_engagement=round(avg_eng, 1),
        last_people_trigger=last_trigger,
        total_customers=total_cust,
        high_churn_customers=high_churn,
        arr_at_risk=arr_at_risk,
        avg_health=round(avg_health, 1),
        recent_context=recent_context,
    )

    response = await _claude.messages.create(
        model=settings.analyst_model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    content = response.content[0].text.strip()

    # Cache for today
    end_of_day = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59).isoformat()
    sb.table("morning_briefs").upsert({
        "org_id": str(org_id),
        "user_id": str(user_id),
        "content": content,
        "brief_date": today,
        "valid_until": end_of_day,
    }, on_conflict="org_id,user_id,brief_date").execute()

    return content
