"""
AI query pipeline — streaming SSE generator.

Steps:
  1. Intent Router (Haiku)      → classify intent, decide if SQL/RAG needed
  2. SQL Analyst (Sonnet)       → generate SQL if needed
  3. Data Executor              → run SQL against Supabase
  4. RAG Retriever              → entity-filtered pgvector similarity search
  5. Response Generator (Sonnet)→ stream narrative answer
  6. Critic (Haiku)             → review response quality
  7. Refiner (Sonnet)           → refine if critic flagged issues
  8. Action Planner (Haiku)     → suggest 1-3 draft actions
"""

import json
from uuid import UUID
from datetime import datetime, timezone
from typing import AsyncGenerator

import anthropic

from app.core.config import settings
from app.db.client import get_supabase
from app.services.ai.embedder import similarity_search
from app.services.ai.entity_cards import build_entity_cards

_claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

_INTENT_PROMPT = """You are an intent classifier for an executive analytics platform.

Module: {module}
{history_section}
Current question: {question}

If the current question is a follow-up that depends on prior turns (e.g. "what about Sales?", "show me their compensation"), produce a sql_hint that resolves the reference into a self-contained description.

Return ONLY a valid JSON object:
{{
  "needs_sql": true | false,
  "needs_rag": true | false,
  "sql_hint": "plain-English description of what data to fetch, or null",
  "entity_focus": "employee" | "customer" | "aggregate" | null
}}"""

_SQL_PROMPT = """You are a SQL analyst. Generate a read-only SELECT query for this request.

Database tables available (Postgres):
- employees (id, org_id, name, email, department, role, level, location, latest_attrition_risk_score, latest_engagement_score, latest_performance_score, scores_last_updated_at)
- compensation (employee_id, salary, market_benchmark, compa_ratio, last_review_date)
- customers (id, org_id, name, segment, arr, renewal_date, latest_churn_score, latest_health_score, latest_revenue_at_risk)
- churn_signals (customer_id, signal_type, value, recorded_at)
- kpis (org_id, name, category, value, target, unit, period, trend, recorded_at)

Org filter: org_id = '{org_id}'
Module: {module}
Request: {sql_hint}

Rules — read carefully:
- Always include the entity's `id` column in the SELECT when querying employees or customers (the UI looks it up by id to render entity cards).
- Keep the query short and direct: SELECT … FROM … JOIN … WHERE … ORDER BY … LIMIT.
- Do NOT add CASE/ROUND/derived columns or scoring logic — return the raw columns and let the application layer compute. Long SQL gets truncated.
- Cap LIMIT at 10 unless the request explicitly asks for more.
- When ranking employees by attrition risk or customers by churn risk, FILTER OUT rows where the relevant `latest_*_score` IS NULL (these are unscored entities and shouldn't surface).
- When sorting by a *_score column DESC, end the ORDER BY with `NULLS LAST`.
- Do NOT include a trailing semicolon on the query — the runner wraps it in an outer SELECT.

Return ONLY the SQL query. No explanation, no markdown, no code fences."""

_RESPONSE_PROMPT = """You are StratIQ, an AI executive decision assistant.

Module: {module}

{global_context}
{history_section}
Current question: {question}

Structured data results:
{sql_results}

Relevant context from documents (call notes, survey responses):
{rag_context}

Answer the question clearly and concisely. Be specific — cite numbers, names, and dates from the data.
Use the org context above to ground your answer in the current state of the business; reference active alerts and KPI gaps where relevant.
If the data shows concerning trends, surface them directly.
If the question is a follow-up referring to prior turns, resolve the reference using the conversation history.

**Critical: if the rag_context section contains real document content, you MUST use it.** Synthesize themes, quote where useful, and reference the source. Never claim you "don't have access to" or "can't surface" content that is literally provided to you in rag_context — that is a hallucination. If the documents only partially match the user's filter (e.g. they ask about Engineering and only some chunks are from Engineering employees), just call that out briefly and synthesize what you do have.

When the structured results contain a list of employees or customers, the UI renders them as visual cards above your reply.
**Do NOT enumerate or list those entities again** in your response — the cards already show name, score, and key stats.
Instead, write a 2-4 sentence synthesis of the pattern: what's driving the risk, what stands out, and what the user should focus on next.

**Do NOT add a "Recommended actions" section, bullet list, or anything action-shaped at the end of your response.** Recommended actions are surfaced separately as interactive cards below your reply (the user can edit and approve them in one click). Repeating them in text is redundant and clutters the response.

Keep the answer to 2-5 sentences. Stop after the synthesis."""

_CRITIC_PROMPT = """Review this AI response for accuracy and usefulness.

Question: {question}
Response: {response}

Return ONLY a valid JSON object:
{{
  "severity": "none" | "minor" | "major",
  "issues": ["list of specific issues, or empty array"],
  "suggestion": "how to improve, or null"
}}"""

_REFINE_PROMPT = """Improve this response based on the critique.

Original question: {question}
Original response: {response}
Critique: {critique}

Provide the improved response only. No preamble."""

_ACTION_PROMPT = """Based on this analytics question and AI response, suggest 1-3 concrete actions the executive should take.

Module: {module}
Question: {question}
AI Response summary: {response_summary}

Return ONLY a valid JSON array of action objects:
[
  {{
    "type": "email_send" | "task" | "meeting_ics" | "pdf_report" | "csv_export",
    "title": "action title",
    "description": "why this action is recommended",
    "source_entity_type": "employee" | "customer" | null,
    "source_entity_name": "name or null"
  }}
]"""


_HISTORY_TURN_LIMIT = 6


async def run_query_pipeline(
    *,
    org_id: UUID,
    user_id: UUID,
    module: str,
    question: str,
    session_id: UUID | None = None,
) -> AsyncGenerator[str, None]:
    sb = get_supabase()
    start_ms = _now_ms()

    # Resolve or create session
    session_id_str: str
    if session_id is None:
        session_row = sb.table("chat_sessions").insert({
            "org_id": str(org_id),
            "user_id": str(user_id),
            "module": module,
            "title": _make_title(question),
        }).execute().data[0]
        session_id_str = session_row["id"]
    else:
        session_id_str = str(session_id)

    # Pull prior turns (before inserting the new one)
    prior_turns = (
        sb.table("queries")
        .select("question, response")
        .eq("session_id", session_id_str)
        .order("created_at", desc=False)
        .limit(_HISTORY_TURN_LIMIT)
        .execute()
        .data
    )
    history_section = _format_history(prior_turns)

    # Persist query row
    query_row = sb.table("queries").insert({
        "org_id": str(org_id),
        "user_id": str(user_id),
        "session_id": session_id_str,
        "module": module,
        "question": question,
    }).execute().data[0]
    query_id = query_row["id"]

    # Tell the client which session this is (matters when one was created)
    yield _sse("session", {"session_id": session_id_str})

    # Bump session updated_at
    sb.table("chat_sessions").update({
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", session_id_str).execute()

    # Action-intent fork: if the user is asking us to TAKE an action rather than answer a question,
    # short-circuit into the action creator and skip SQL/RAG/critic/refiner.
    #
    # plan_or_draft may decide we need more info from the user. In that case we stream a
    # clarifying question and bail out — DO NOT create an action. The next user turn will
    # be detected as a continuation (see detect_action_intent) and routed back here.
    from app.services.ai.action_creator import detect_action_intent, plan_or_draft, persist_draft
    intent = await detect_action_intent(question, module, history_section)
    SUPPORTED_ACTIONS = ("task", "email_send", "pdf_report", "meeting_ics")
    if intent.get("is_action") and intent.get("action_type") in SUPPORTED_ACTIONS:
        yield _sse("status", {"step": "action_drafting", "message": "Working on this action…"})
        try:
            plan = await plan_or_draft(
                org_id=org_id,
                message=question,
                module=module,
                action_type=intent["action_type"],
                entity_hint=intent.get("entity_hint"),
                history_section=history_section,
            )

            if plan.get("needs_clarification"):
                narrative = plan.get("question") or "Could you tell me a bit more?"
                yield _sse("token", {"text": narrative})
                sb.table("queries").update({
                    "response": {"narrative": narrative, "pending_action_type": intent["action_type"]},
                    "latency_ms": _now_ms() - start_ms,
                }).eq("id", query_id).execute()
                yield _sse("done", {
                    "query_id": query_id,
                    "session_id": session_id_str,
                    "response": narrative,
                    "sources": [],
                    "suggested_actions": [],
                    "latency_ms": _now_ms() - start_ms,
                })
                return

            # Persist each draft and emit one action_draft event per draft.
            # Approval happens INLINE in chat — see ActionDraftCard.
            persisted: list[dict] = []
            for d in plan["drafts"]:
                draft = await persist_draft(
                    org_id=org_id,
                    user_id=user_id,
                    module=module,
                    action_type=intent["action_type"],
                    plan=d,
                    query_id=query_id,
                )
                persisted.append(draft)
                yield _sse("action_draft", {"action": draft})

            narrative = _multi_draft_narrative(persisted)
            sb.table("queries").update({
                "response": {
                    "narrative": narrative,
                    "drafted_action_ids": [d["id"] for d in persisted],
                },
                "latency_ms": _now_ms() - start_ms,
            }).eq("id", query_id).execute()
            yield _sse("done", {
                "query_id": query_id,
                "session_id": session_id_str,
                "response": narrative,
                "sources": [],
                "suggested_actions": [],
                "latency_ms": _now_ms() - start_ms,
            })
            return
        except Exception as exc:
            err = f"Couldn't draft that action: {exc}"
            yield _sse("token", {"text": err})
            yield _sse("done", {
                "query_id": query_id,
                "session_id": session_id_str,
                "response": err,
                "sources": [],
                "suggested_actions": [],
                "latency_ms": _now_ms() - start_ms,
            })
            return

    if settings.mock_ai:
        mock_response = (
            f"[Mock AI] You asked: \"{question}\"\n\n"
            "This is a mock response. The full AI pipeline (intent classification, SQL generation, "
            "RAG retrieval, critique-and-refine) is bypassed while MOCK_AI=true. "
            "Set MOCK_AI=false in your .env and ensure Anthropic and OpenAI credits are loaded to enable real AI responses."
        )
        sb.table("queries").update({
            "response": {"narrative": mock_response},
            "latency_ms": _now_ms() - start_ms,
        }).eq("id", query_id).execute()
        yield _sse("token", {"text": mock_response})
        yield _sse("done", {"query_id": query_id, "session_id": session_id_str, "response": mock_response, "sources": [], "suggested_actions": [], "latency_ms": _now_ms() - start_ms})
        return

    yield _sse("status", {"step": "intent", "message": "Analyzing your question..."})

    # Step 1: Intent classification
    intent_resp = await _claude.messages.create(
        model=settings.intent_model,
        max_tokens=256,
        messages=[{"role": "user", "content": _INTENT_PROMPT.format(module=module, question=question, history_section=history_section)}],
    )
    intent = _parse_json(intent_resp.content[0].text)
    needs_sql = intent.get("needs_sql", True)
    needs_rag = intent.get("needs_rag", True)
    entity_focus = intent.get("entity_focus")

    sb.table("queries").update({
        "intent_classified": json.dumps(intent),
        "needs_sql": needs_sql,
        "needs_rag": needs_rag,
    }).eq("id", query_id).execute()

    # Step 2 & 3: SQL generation + execution
    sql_results = []
    generated_sql = None
    if needs_sql and intent.get("sql_hint"):
        yield _sse("status", {"step": "data", "message": "Fetching relevant data..."})
        sql_prompt = _SQL_PROMPT.format(module=module, org_id=str(org_id), sql_hint=intent["sql_hint"])
        sql_resp = await _claude.messages.create(
            model=settings.analyst_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": sql_prompt}],
        )
        generated_sql = sql_resp.content[0].text.strip()
        # The execute_read_query RPC wraps the query in a subquery — a trailing
        # semicolon breaks out of that wrapper and triggers a syntax error.
        # Strip any trailing whitespace/semicolons defensively.
        generated_sql = generated_sql.rstrip().rstrip(";").rstrip()
        # Execute via Supabase RPC (safe read-only wrapper)
        try:
            exec_result = sb.rpc("execute_read_query", {"sql": generated_sql}).execute()
            sql_results = exec_result.data or []
        except Exception:
            sql_results = []

    # Step 3.5: Entity cards — when the question is about a list of employees or
    # customers, send structured card data to the UI alongside the narrative.
    if entity_focus in ("employee", "customer") and sql_results:
        try:
            cards = await build_entity_cards(sb, org_id, entity_focus, sql_results)
            if cards:
                yield _sse("entity_cards", {"entity_type": entity_focus, "cards": cards})
        except Exception:
            # Non-fatal — narrative response still renders.
            pass

    # Step 4: RAG retrieval
    rag_chunks = []
    sources = []
    if needs_rag:
        yield _sse("status", {"step": "rag", "message": "Searching relevant documents..."})
        rag_chunks = await similarity_search(
            query_text=question,
            org_id=org_id,
            entity_type=entity_focus if entity_focus in ("employee", "customer") else None,
        )
        sources = [
            {
                "type": c.get("source_type"),
                "id": c.get("source_id"),
                "entity_type": c.get("entity_type"),
                "entity_id": c.get("entity_id"),
                "excerpt": c.get("content", "")[:200],
                "metadata": c.get("metadata"),
            }
            for c in rag_chunks
        ]

    # Enrich each chunk with attribution (employee name + dept, or customer name + segment)
    # so the AI can mentally group them when answering filtered questions like "...for Engineering".
    rag_context = _format_rag_context_with_attribution(sb, str(org_id), rag_chunks[:settings.rag_top_k])

    # Step 4.5: Context Injector — merge org-wide state into the prompt.
    yield _sse("status", {"step": "context", "message": "Loading org context…"})
    from app.services.ai.context_injector import inject_context
    global_context = await inject_context(org_id=org_id, user_id=user_id, module=module)

    # Step 5: Response generation (streaming)
    yield _sse("status", {"step": "generating", "message": "Generating response..."})
    response_text = ""
    response_prompt = _RESPONSE_PROMPT.format(
        module=module,
        question=question,
        global_context=global_context or "(no broader context available)",
        history_section=history_section,
        sql_results=json.dumps(sql_results[:50], default=str),
        rag_context=rag_context or "No relevant documents found.",
    )

    async with _claude.messages.stream(
        model=settings.analyst_model,
        max_tokens=1024,
        messages=[{"role": "user", "content": response_prompt}],
    ) as stream:
        async for text in stream.text_stream:
            response_text += text
            yield _sse("token", {"text": text})

    # Step 6: Critic
    yield _sse("status", {"step": "reviewing", "message": "Reviewing response quality..."})
    critic_resp = await _claude.messages.create(
        model=settings.critic_model,
        max_tokens=256,
        messages=[{"role": "user", "content": _CRITIC_PROMPT.format(question=question, response=response_text)}],
    )
    critique = _parse_json(critic_resp.content[0].text)

    # Step 7: Refine if needed
    final_response = response_text
    if critique.get("severity") in ("minor", "major"):
        yield _sse("status", {"step": "refining", "message": "Refining response..."})
        refined = await _claude.messages.create(
            model=settings.refiner_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": _REFINE_PROMPT.format(
                question=question,
                response=response_text,
                critique=json.dumps(critique),
            )}],
        )
        final_response = refined.content[0].text
        yield _sse("refined", {"text": final_response})

    # Step 8: Action planner
    action_resp = await _claude.messages.create(
        model=settings.intent_model,
        max_tokens=512,
        messages=[{"role": "user", "content": _ACTION_PROMPT.format(
            module=module,
            question=question,
            response_summary=final_response[:500],
        )}],
    )
    suggested_actions = _parse_json_array(action_resp.content[0].text)

    # Persist draft actions
    from app.schemas.actions import tier_for
    created_actions = []
    for act in suggested_actions[:3]:
        act_type = act.get("type", "task")
        # Filter to supported types only
        if act_type not in ("task", "email_send", "pdf_report"):
            continue
        tier = tier_for(act_type)
        # Auto-suggested actions need a payload — drop in a minimal valid one so they can execute later.
        if act_type == "task":
            payload = {"notes": act.get("description", "")}
        elif act_type == "pdf_report":
            payload = {
                "report_type": "general",
                "sections": [{"heading": "Summary", "body": act.get("description", "")}],
            }
        else:  # email_send — needs editing before send, leave a minimal scaffold
            payload = {
                "recipients": ["recipient@example.com"],
                "subject": act.get("title", "Follow-up"),
                "body_markdown": act.get("description", ""),
                "from_persona": "system",
            }
        action_row = sb.table("actions").insert({
            "org_id": str(org_id),
            "user_id": str(user_id),
            "type": act_type,
            "title": act.get("title", ""),
            "description": act.get("description", ""),
            "source_module": module,
            "source_entity_type": act.get("source_entity_type"),
            "query_id": query_id,
            "payload": payload,
            "approval_tier": tier,
            "status": "draft" if tier == "low" else "pending_approval",
        }).execute().data[0]
        created_actions.append(action_row)
        # Stream as an inline action card — same UX as the explicit action-fork path.
        yield _sse("action_draft", {"action": action_row})

    # Finalize query row
    latency = _now_ms() - start_ms
    sb.table("queries").update({
        "sql_generated": generated_sql,
        "rag_chunks_used": [c.get("id") for c in rag_chunks],
        "sources": sources,
        "response": {"narrative": final_response, "suggested_actions": created_actions},
        "critique_issues": critique if critique.get("severity") != "none" else None,
        "latency_ms": latency,
    }).eq("id", query_id).execute()

    yield _sse("done", {
        "query_id": query_id,
        "session_id": session_id_str,
        "response": final_response,
        "sources": sources,
        "suggested_actions": created_actions,
        "latency_ms": latency,
    })


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _multi_draft_narrative(drafts: list[dict]) -> str:
    """Compose the chat reply when one or more drafts are awaiting inline approval."""
    if not drafts:
        return "I couldn't draft anything from that — try rephrasing?"
    if len(drafts) == 1:
        d = drafts[0]
        title = d.get("title") or "this action"
        return f"I drafted **{title}** — review the details below and approve or cancel."
    # Plural — list the titles for context
    titles = ", ".join((d.get("title") or "untitled") for d in drafts[:5])
    extra = f" (+ {len(drafts) - 5} more)" if len(drafts) > 5 else ""
    return f"I drafted {len(drafts)} actions: {titles}{extra}. Review each below."


def _make_title(question: str, max_chars: int = 60) -> str:
    q = question.strip()
    if len(q) <= max_chars:
        return q
    return q[: max_chars - 1].rsplit(" ", 1)[0] + "…"


def _format_history(turns: list[dict]) -> str:
    """Format prior turns for inclusion in prompts. Returns empty string when no history."""
    if not turns:
        return ""
    lines = ["Conversation history (oldest first):"]
    for t in turns:
        q = (t.get("question") or "").strip()
        resp = t.get("response") or {}
        narrative = resp.get("narrative") if isinstance(resp, dict) else None
        a = (narrative or "").strip()
        if not a:
            continue
        # Trim each turn to keep token cost bounded
        if len(a) > 500:
            a = a[:497] + "…"
        lines.append(f"User: {q}")
        lines.append(f"Assistant: {a}")
    return "\n".join(lines) + "\n"


def _now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


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


def _parse_json_array(text: str) -> list:
    import re
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return []


def _format_rag_context_with_attribution(sb, org_id: str, chunks: list[dict]) -> str:
    """Stitch retrieved chunks into a context block with [name — dept/segment]
    attribution per chunk, so the response generator can answer department- or
    segment-filtered questions ("themes in Engineering's survey") without
    seeing only naked text.
    """
    if not chunks:
        return ""

    employee_ids = sorted({c.get("entity_id") for c in chunks if c.get("entity_type") == "employee" and c.get("entity_id")})
    customer_ids = sorted({c.get("entity_id") for c in chunks if c.get("entity_type") == "customer" and c.get("entity_id")})

    employee_meta: dict[str, dict] = {}
    if employee_ids:
        try:
            rows = (
                sb.table("employees")
                .select("id, name, department, role, level")
                .eq("org_id", org_id)
                .in_("id", employee_ids)
                .execute()
                .data
                or []
            )
            for r in rows:
                employee_meta[r["id"]] = r
        except Exception:
            pass

    customer_meta: dict[str, dict] = {}
    if customer_ids:
        try:
            rows = (
                sb.table("customers")
                .select("id, name, segment, tier")
                .eq("org_id", org_id)
                .in_("id", customer_ids)
                .execute()
                .data
                or []
            )
            for r in rows:
                customer_meta[r["id"]] = r
        except Exception:
            pass

    parts: list[str] = []
    for c in chunks:
        content = (c.get("content") or "").strip()
        if not content:
            continue
        attribution = "[unattributed]"
        if c.get("entity_type") == "employee":
            m = employee_meta.get(c.get("entity_id") or "")
            if m:
                bits = [m.get("name"), m.get("department"), m.get("role"), m.get("level")]
                attribution = "[" + " — ".join(b for b in bits if b) + "]"
        elif c.get("entity_type") == "customer":
            m = customer_meta.get(c.get("entity_id") or "")
            if m:
                bits = [m.get("name"), m.get("segment"), m.get("tier")]
                attribution = "[" + " — ".join(b for b in bits if b) + "]"

        source_label = "survey" if c.get("source_type") == "survey_response" else (
            "CSM note" if c.get("source_type") == "csm_note" else (c.get("source_type") or "doc")
        )
        parts.append(f"{attribution} ({source_label}): {content}")

    return "\n---\n".join(parts)
