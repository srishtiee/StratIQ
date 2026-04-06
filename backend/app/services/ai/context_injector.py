"""
Context Injector — Step 2 of the AI pipeline.

Builds a compact text block describing org-wide state so the response generator
can ground answers in current facts (KPIs, alerts, module snapshot, pending
approvals) instead of treating every question in isolation.

Output is plain text, ~300-600 tokens. Empty string when no data exists.
"""

from uuid import UUID

from app.db.client import get_supabase


async def inject_context(*, org_id: UUID, user_id: UUID, module: str) -> str:
    """Return a formatted org context block. Called per query."""
    sb = get_supabase()
    parts: list[str] = []

    # 1. Latest KPI values
    kpi_rows = (
        sb.table("kpis")
        .select("name, value, target, unit, period")
        .eq("org_id", str(org_id))
        .order("period", desc=True)
        .limit(40)
        .execute()
        .data
    )
    latest: dict[str, dict] = {}
    for row in kpi_rows:
        if row["name"] not in latest:
            latest[row["name"]] = row
    if latest:
        kpi_strs = []
        for name, k in list(latest.items())[:6]:
            val = _fmt_value(k.get("value"), k.get("unit"))
            target = (
                f" (target {_fmt_value(k['target'], k.get('unit'))})"
                if k.get("target") is not None
                else ""
            )
            kpi_strs.append(f"{name}: {val}{target}")
        parts.append("KPIs: " + " · ".join(kpi_strs))

    # 2. Active alerts (most recent unread)
    alerts = (
        sb.table("notifications")
        .select("type, message")
        .eq("org_id", str(org_id))
        .eq("read", False)
        .order("created_at", desc=True)
        .limit(3)
        .execute()
        .data
    )
    if alerts:
        lines = [f"  - {(a.get('message') or '').strip()}" for a in alerts]
        parts.append(f"Active alerts ({len(alerts)}):\n" + "\n".join(lines))

    # 3. Module-specific snapshot
    if module == "people":
        emps = (
            sb.table("employees")
            .select("latest_attrition_risk_score, latest_engagement_score")
            .eq("org_id", str(org_id))
            .eq("status", "active")
            .execute()
            .data
        )
        total = len(emps)
        if total:
            high_risk = sum(1 for e in emps if (e.get("latest_attrition_risk_score") or 0) >= 70)
            avg_eng = sum((e.get("latest_engagement_score") or 0) for e in emps) / total
            parts.append(
                f"People snapshot: {total} active employees, "
                f"{high_risk} high-risk (≥70), avg engagement {round(avg_eng)}"
            )
    elif module == "retention":
        custs = (
            sb.table("customers")
            .select("arr, latest_churn_score, latest_revenue_at_risk")
            .eq("org_id", str(org_id))
            .eq("status", "active")
            .execute()
            .data
        )
        total = len(custs)
        if total:
            high_churn = sum(1 for c in custs if (c.get("latest_churn_score") or 0) >= 70)
            total_arr = sum(float(c.get("arr") or 0) for c in custs)
            arr_at_risk = sum(float(c.get("latest_revenue_at_risk") or 0) for c in custs)
            parts.append(
                f"Retention snapshot: {total} customers, {high_churn} high-churn (≥70), "
                f"total ARR {_fmt_value(total_arr, 'USD')}, "
                f"ARR at risk {_fmt_value(arr_at_risk, 'USD')}"
            )

    # 4. Pending approvals waiting on the user
    pending = (
        sb.table("actions")
        .select("title", count="exact")
        .eq("org_id", str(org_id))
        .eq("status", "pending_approval")
        .limit(2)
        .execute()
    )
    pending_count = pending.count or 0
    if pending_count > 0:
        titles = [p["title"] for p in (pending.data or [])[:2] if p.get("title")]
        suffix = (": " + "; ".join(titles)) if titles else ""
        parts.append(f"Pending approvals ({pending_count}){suffix}")

    if not parts:
        return ""

    return "Current org context:\n" + "\n".join(parts) + "\n"


def _fmt_value(v, unit: str | None) -> str:
    if v is None:
        return "—"
    try:
        n = float(v)
    except (TypeError, ValueError):
        return str(v)
    if unit == "USD":
        if n >= 1_000_000:
            return f"${n / 1_000_000:.1f}M"
        if n >= 1_000:
            return f"${n / 1_000:.0f}K"
        return f"${n:.0f}"
    if unit == "%":
        if n == int(n):
            return f"{int(n)}%"
        return f"{n:.1f}%"
    if n == int(n):
        return str(int(n))
    return f"{n:.2f}"
