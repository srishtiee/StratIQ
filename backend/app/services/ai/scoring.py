"""
AI rescoring for employees (People) and customers (Retention).

Called after unstructured uploads (survey_responses, csm_notes) — or on schedule.
For each affected entity:
  1. Pull structured data (scores, compensation, signals)
  2. Pull relevant RAG chunks (entity-filtered)
  3. Call Claude to produce a new score + plain-English rationale
  4. Write employee_scores / customer_scores row
  5. Write ai_entity_reasoning row
  6. Update employees.latest_* / customers.latest_*
"""

import json
from uuid import UUID
from datetime import datetime, timezone

import anthropic

from app.core.config import settings
from app.db.client import get_supabase, fetch_one
from app.services.ai.embedder import similarity_search

_claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_PEOPLE_SCORE_PROMPT = """You are an HR AI assistant scoring employee attrition risk.

Employee data:
{employee_data}

Recent survey signals:
{survey_signals}

Relevant survey excerpts:
{rag_context}

Score this employee's attrition risk on a scale of 0-100, where:
  0-30 = low risk, 31-60 = medium risk, 61-80 = high risk, 81-100 = critical

Return ONLY a valid JSON object:
{{
  "attrition_risk_score": 0-100,
  "engagement_score": 0-100,
  "reasoning": "one or two sentence plain-English rationale shown in the UI",
  "contributing_factors": {{
    "comp_gap": 0.0-1.0,
    "engagement_signals": 0.0-1.0,
    "survey_signal": 0.0-1.0,
    "tenure_risk": 0.0-1.0
  }}
}}"""

_RETENTION_SCORE_PROMPT = """You are a Customer Success AI assistant scoring churn risk.

Customer data:
{customer_data}

Recent call note signals:
{csm_signals}

Relevant call note excerpts:
{rag_context}

Score this customer's churn risk on a scale of 0-100, where:
  0-30 = low risk, 31-60 = medium risk, 61-80 = high risk, 81-100 = critical

Return ONLY a valid JSON object:
{{
  "churn_score": 0-100,
  "health_score": 0-100,
  "revenue_at_risk": estimated ARR dollars at risk (number),
  "reasoning": "one or two sentence plain-English rationale shown in the UI",
  "contributing_factors": {{
    "usage_drop": 0.0-1.0,
    "call_note_signal": 0.0-1.0,
    "renewal_urgency": 0.0-1.0,
    "nps_signal": 0.0-1.0
  }}
}}"""


async def trigger_people_rescoring(
    *,
    org_id: UUID,
    employee_ids: list[str],
    trigger_type: str,
    trigger_source_id: str,
) -> str:
    """Create an ai_analysis_runs row and rescore each employee. Returns run_id."""
    sb = get_supabase()

    run = sb.table("ai_analysis_runs").insert({
        "org_id": str(org_id),
        "trigger_type": trigger_type,
        "trigger_id": trigger_source_id,
        "module": "people",
        "entities_analyzed": len(employee_ids),
        "model_used": settings.analyst_model,
        "status": "running",
    }).execute().data[0]
    run_id = run["id"]

    for emp_id in employee_ids:
        await _rescore_employee(org_id=org_id, employee_id=emp_id, run_id=run_id, trigger_type=trigger_type, trigger_source_id=trigger_source_id)

    sb.table("ai_analysis_runs").update({"status": "complete"}).eq("id", run_id).execute()
    return run_id


async def trigger_retention_rescoring(
    *,
    org_id: UUID,
    customer_ids: list[str],
    trigger_type: str,
    trigger_source_id: str,
) -> str:
    sb = get_supabase()

    run = sb.table("ai_analysis_runs").insert({
        "org_id": str(org_id),
        "trigger_type": trigger_type,
        "trigger_id": trigger_source_id,
        "module": "retention",
        "entities_analyzed": len(customer_ids),
        "model_used": settings.analyst_model,
        "status": "running",
    }).execute().data[0]
    run_id = run["id"]

    for cust_id in customer_ids:
        await _rescore_customer(org_id=org_id, customer_id=cust_id, run_id=run_id, trigger_type=trigger_type, trigger_source_id=trigger_source_id)

    sb.table("ai_analysis_runs").update({"status": "complete"}).eq("id", run_id).execute()
    return run_id


async def _rescore_employee(*, org_id: UUID, employee_id: str, run_id: str, trigger_type: str, trigger_source_id: str):
    sb = get_supabase()

    emp = fetch_one(
        sb.table("employees").select(
            "name, department, role, level, location, hire_date, "
            "latest_attrition_risk_score, latest_engagement_score, latest_performance_score, "
            "compensation(salary, market_benchmark, compa_ratio), "
            "survey_responses(ai_extracted_signals, created_at)"
        ).eq("id", employee_id)
    )

    if not emp:
        return

    score_before = emp.get("latest_attrition_risk_score") or 0

    # Only call embeddings API if chunks exist for this entity
    has_chunks = sb.table("document_chunks").select("id").eq("org_id", str(org_id)).eq("entity_type", "employee").eq("entity_id", employee_id).limit(1).execute().data
    if has_chunks:
        chunks = await similarity_search(
            query_text=f"employee risk signals for {emp.get('name', '')}",
            org_id=org_id,
            entity_type="employee",
            entity_ids=[employee_id],
        )
        rag_context = "\n---\n".join(c.get("content", "") for c in chunks[:3])
    else:
        rag_context = ""

    latest_signals = {}
    if emp.get("survey_responses"):
        latest_signals = emp["survey_responses"][-1].get("ai_extracted_signals") or {}

    prompt = _PEOPLE_SCORE_PROMPT.format(
        employee_data=json.dumps({k: v for k, v in emp.items() if k not in ("survey_responses",)}, default=str),
        survey_signals=json.dumps(latest_signals),
        rag_context=rag_context or "No recent survey responses available.",
    )

    if settings.mock_ai:
        result = {
            "attrition_risk_score": min(100, score_before + 5),
            "engagement_score": 65,
            "reasoning": "Mock scoring — upload survey responses and set MOCK_AI=false for real AI analysis.",
            "contributing_factors": {"comp_gap": 0.3, "engagement_signals": 0.2, "survey_signal": 0.0, "tenure_risk": 0.1},
        }
    else:
        response = await _claude.messages.create(
            model=settings.analyst_model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        result = _parse_json(response.content[0].text)

    now = datetime.now(timezone.utc).isoformat()
    score_after = result.get("attrition_risk_score", score_before)

    sb.table("employee_scores").insert({
        "org_id": str(org_id),
        "employee_id": employee_id,
        "attrition_risk_score": score_after,
        "engagement_score": result.get("engagement_score"),
        "trigger_type": trigger_type,
        "trigger_source_id": trigger_source_id,
        "ai_rationale": result.get("reasoning"),
        "contributing_factors": result.get("contributing_factors"),
    }).execute()

    sb.table("ai_entity_reasoning").insert({
        "org_id": str(org_id),
        "run_id": run_id,
        "entity_type": "employee",
        "entity_id": employee_id,
        "reasoning": result.get("reasoning", ""),
        "score_before": score_before,
        "score_after": score_after,
        "delta": round(score_after - score_before, 2),
        "factors": result.get("contributing_factors"),
    }).execute()

    sb.table("employees").update({
        "latest_attrition_risk_score": score_after,
        "latest_engagement_score": result.get("engagement_score"),
        "scores_last_updated_at": now,
    }).eq("id", employee_id).execute()


async def _rescore_customer(*, org_id: UUID, customer_id: str, run_id: str, trigger_type: str, trigger_source_id: str):
    sb = get_supabase()

    cust = fetch_one(
        sb.table("customers").select(
            "name, segment, arr, renewal_date, latest_churn_score, latest_health_score, "
            "csm_notes(ai_extracted_signals, meeting_date, note_type), "
            "churn_signals(signal_type, value, recorded_at)"
        ).eq("id", customer_id)
    )

    if not cust:
        return

    score_before = cust.get("latest_churn_score") or 0

    has_chunks = sb.table("document_chunks").select("id").eq("org_id", str(org_id)).eq("entity_type", "customer").eq("entity_id", customer_id).limit(1).execute().data
    if has_chunks:
        chunks = await similarity_search(
            query_text=f"churn risk signals for {cust.get('name', '')}",
            org_id=org_id,
            entity_type="customer",
            entity_ids=[customer_id],
        )
        rag_context = "\n---\n".join(c.get("content", "") for c in chunks[:3])
    else:
        rag_context = ""

    latest_signals = {}
    if cust.get("csm_notes"):
        sorted_notes = sorted(cust["csm_notes"], key=lambda n: n.get("meeting_date") or "", reverse=True)
        latest_signals = sorted_notes[0].get("ai_extracted_signals") or {}

    prompt = _RETENTION_SCORE_PROMPT.format(
        customer_data=json.dumps({k: v for k, v in cust.items() if k not in ("csm_notes", "churn_signals")}, default=str),
        csm_signals=json.dumps(latest_signals),
        rag_context=rag_context or "No recent call notes available.",
    )

    if settings.mock_ai:
        result = {
            "churn_score": min(100, score_before + 5),
            "health_score": 60,
            "revenue_at_risk": cust.get("arr", 0) * 0.3,
            "reasoning": "Mock scoring — upload CSM notes and set MOCK_AI=false for real AI analysis.",
            "contributing_factors": {"usage_drop": 0.3, "call_note_signal": 0.0, "renewal_urgency": 0.2, "nps_signal": 0.1},
        }
    else:
        response = await _claude.messages.create(
            model=settings.analyst_model,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        result = _parse_json(response.content[0].text)

    now = datetime.now(timezone.utc).isoformat()
    score_after = result.get("churn_score", score_before)

    sb.table("customer_scores").insert({
        "org_id": str(org_id),
        "customer_id": customer_id,
        "churn_score": score_after,
        "health_score": result.get("health_score"),
        "revenue_at_risk": result.get("revenue_at_risk"),
        "trigger_type": trigger_type,
        "trigger_source_id": trigger_source_id,
        "ai_rationale": result.get("reasoning"),
        "contributing_factors": result.get("contributing_factors"),
    }).execute()

    sb.table("ai_entity_reasoning").insert({
        "org_id": str(org_id),
        "run_id": run_id,
        "entity_type": "customer",
        "entity_id": customer_id,
        "reasoning": result.get("reasoning", ""),
        "score_before": score_before,
        "score_after": score_after,
        "delta": round(score_after - score_before, 2),
        "factors": result.get("contributing_factors"),
    }).execute()

    sb.table("customers").update({
        "latest_churn_score": score_after,
        "latest_health_score": result.get("health_score"),
        "latest_revenue_at_risk": result.get("revenue_at_risk"),
        "scores_last_updated_at": now,
    }).eq("id", customer_id).execute()


def _parse_json(text: str) -> dict:
    import re
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return {}
