"""Build structured entity cards from SQL pipeline results.

When the AI pipeline's intent router classifies a question as `entity_focus =
'employee'` or `'customer'`, we surface the matching entities as visual cards
in the chat UI in addition to the narrative summary.

This module turns raw SQL rows (which may be partial projections) into full
card payloads by re-fetching the entities by id or name and joining their
latest AI rationale.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID


def _row_id(row: dict, *keys: str) -> str | None:
    for k in keys:
        v = row.get(k)
        if isinstance(v, str) and v:
            return v
    return None


def _collect_keys(rows: list[dict], id_keys: tuple[str, ...], name_keys: tuple[str, ...]) -> tuple[list[str], list[str]]:
    ids: list[str] = []
    names: list[str] = []
    for row in rows or []:
        rid = _row_id(row, *id_keys)
        if rid:
            ids.append(rid)
            continue
        rname = _row_id(row, *name_keys)
        if rname:
            names.append(rname)
    return ids[:8], names[:8]


async def build_entity_cards(
    sb: Any,
    org_id: UUID,
    entity_focus: str | None,
    sql_results: list[dict],
) -> list[dict]:
    """Return up to 8 entity cards for the chat UI, or [] when not applicable.

    Each card has a normalized shape the frontend can render directly:
      {
        "entity_type": "employee" | "customer",
        "entity_id": "...",
        "name": "...",
        "subtitle": "Engineering · IC4",
        "primary_score": {"label": "Attrition", "value": 81, "tier": "critical"},
        "secondary_score": {"label": "Engagement", "value": 42, "tier": "low"},
        "stat": {"label": "Compa-ratio", "value": "0.74"},
        "rationale": "Short AI rationale...",
      }
    """
    if entity_focus not in ("employee", "customer"):
        return []
    if not sql_results:
        return []

    if entity_focus == "employee":
        return await _build_employee_cards(sb, org_id, sql_results)
    return await _build_customer_cards(sb, org_id, sql_results)


# ─────────────────────────── employees ───────────────────────────

async def _build_employee_cards(sb, org_id: UUID, rows: list[dict]) -> list[dict]:
    ids, names = _collect_keys(rows, id_keys=("id", "employee_id"), name_keys=("name", "employee_name"))
    if not ids and not names:
        return []

    select = (
        "id, name, role, department, level, "
        "latest_attrition_risk_score, latest_engagement_score, latest_performance_score, "
        "compensation(salary, market_benchmark, compa_ratio)"
    )
    q = sb.table("employees").select(select).eq("org_id", str(org_id))
    if ids:
        q = q.in_("id", ids)
    else:
        q = q.in_("name", names)
    employees = q.limit(8).execute().data or []
    if not employees:
        return []

    emp_ids = [e["id"] for e in employees]
    rationales = _fetch_latest_rationales(sb, "employee_scores", "employee_id", emp_ids)

    # Preserve original ordering from the SQL results when possible.
    ordering = ids if ids else names
    employees.sort(key=lambda e: ordering.index(e["id"] if ids else e["name"]) if (e["id"] if ids else e["name"]) in ordering else 999)

    cards = []
    for e in employees:
        comp = (e.get("compensation") or [None])[0] if isinstance(e.get("compensation"), list) else e.get("compensation")
        attrition = e.get("latest_attrition_risk_score")
        engagement = e.get("latest_engagement_score")
        compa = comp.get("compa_ratio") if comp else None
        cards.append({
            "entity_type": "employee",
            "entity_id": e["id"],
            "name": e["name"],
            "subtitle": " · ".join(filter(None, [e.get("department"), e.get("role"), e.get("level")])),
            "primary_score": {
                "label": "Attrition Risk",
                "value": _round(attrition),
                "tier": _risk_tier(attrition),
            } if attrition is not None else None,
            "secondary_score": {
                "label": "Engagement",
                "value": _round(engagement),
                "tier": _engagement_tier(engagement),
            } if engagement is not None else None,
            "stat": {
                "label": "Compa-ratio",
                "value": f"{float(compa):.2f}" if compa is not None else "—",
            } if compa is not None else None,
            "rationale": (rationales.get(e["id"]) or "")[:240],
        })
    return cards


# ─────────────────────────── customers ───────────────────────────

async def _build_customer_cards(sb, org_id: UUID, rows: list[dict]) -> list[dict]:
    ids, names = _collect_keys(rows, id_keys=("id", "customer_id"), name_keys=("name", "customer_name"))
    if not ids and not names:
        return []

    select = (
        "id, name, segment, tier, arr, renewal_date, "
        "latest_churn_score, latest_health_score, latest_revenue_at_risk"
    )
    q = sb.table("customers").select(select).eq("org_id", str(org_id))
    if ids:
        q = q.in_("id", ids)
    else:
        q = q.in_("name", names)
    customers = q.limit(8).execute().data or []
    if not customers:
        return []

    cust_ids = [c["id"] for c in customers]
    rationales = _fetch_latest_rationales(sb, "customer_scores", "customer_id", cust_ids)

    ordering = ids if ids else names
    customers.sort(key=lambda c: ordering.index(c["id"] if ids else c["name"]) if (c["id"] if ids else c["name"]) in ordering else 999)

    cards = []
    for c in customers:
        churn = c.get("latest_churn_score")
        rev = c.get("latest_revenue_at_risk")
        cards.append({
            "entity_type": "customer",
            "entity_id": c["id"],
            "name": c["name"],
            "subtitle": " · ".join(filter(None, [c.get("segment"), c.get("tier")])),
            "primary_score": {
                "label": "Churn Risk",
                "value": _round(churn),
                "tier": _risk_tier(churn),
            } if churn is not None else None,
            "secondary_score": {
                "label": "ARR",
                "value": _format_money(c.get("arr")),
                "tier": None,
            } if c.get("arr") is not None else None,
            "stat": {
                "label": "Renewal",
                "value": c.get("renewal_date") or "—",
            },
            "rationale": (rationales.get(c["id"]) or "")[:240],
            "revenue_at_risk": _format_money(rev) if rev is not None else None,
        })
    return cards


# ─────────────────────────── helpers ───────────────────────────

def _fetch_latest_rationales(sb, scores_table: str, fk_col: str, ids: list[str]) -> dict[str, str]:
    """Take the most-recent ai_rationale per entity from a `*_scores` table."""
    if not ids:
        return {}
    rows = (
        sb.table(scores_table)
        .select(f"{fk_col}, ai_rationale, scored_at")
        .in_(fk_col, ids)
        .order("scored_at", desc=True)
        .limit(200)  # bounded; 8 entities * a few revisions is plenty
        .execute()
        .data
        or []
    )
    out: dict[str, str] = {}
    for r in rows:
        eid = r.get(fk_col)
        if eid and eid not in out and r.get("ai_rationale"):
            out[eid] = r["ai_rationale"]
    return out


def _round(v) -> int | None:
    try:
        return int(round(float(v))) if v is not None else None
    except (TypeError, ValueError):
        return None


def _risk_tier(score) -> str | None:
    """Map a 0-100 risk score to {critical, high, moderate, low}."""
    n = _round(score)
    if n is None:
        return None
    if n >= 75:
        return "critical"
    if n >= 55:
        return "high"
    if n >= 35:
        return "moderate"
    return "low"


def _engagement_tier(score) -> str | None:
    """Engagement is inverted: high = good. Map to {strong, ok, low, critical}."""
    n = _round(score)
    if n is None:
        return None
    if n >= 70:
        return "strong"
    if n >= 55:
        return "ok"
    if n >= 40:
        return "low"
    return "critical"


def _format_money(v) -> str:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return "—"
    if n >= 1_000_000:
        return f"${n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"${n / 1_000:.0f}K"
    return f"${n:.0f}"
