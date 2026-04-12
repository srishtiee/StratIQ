"""
Translate a free-text user command into one or more draft actions.

Per turn:
  1. detect_action_intent  — does the user want us to TAKE an action right now?
                             Aware of conversation history so a reply to our own
                             clarifying question is recognised as a continuation.
  2. plan_or_draft         — given the action_type, look at the message and the
                             conversation. Decide if there's enough info to draft.
                             - If not: return ONE clarifying question.
                             - If yes: return a LIST of drafts. A single user
                               request may imply multiple distinct actions
                               (e.g. "schedule 1:1s with X, Y, Z" → 3 meetings).

The pipeline streams the clarifying question or persists each draft in turn.
Approval happens INLINE in chat via an editable form per draft.
"""

import json
from datetime import date
from uuid import UUID

import anthropic

from app.core.config import settings
from app.db.client import get_supabase
from app.schemas.actions import validate_payload, tier_for


_claude = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


# ──────────────────────────────────────────────────────────────────────
# Intent detection — is the user asking us to take an action?
# ──────────────────────────────────────────────────────────────────────
_INTENT_DETECT_PROMPT = """Decide whether the user's most recent message is an instruction to take an action, or just a question to answer with data.

Module: {module}
{history_section}
User's most recent message: {message}

Action types available:
- task         — internal todo / follow-up reminder. No external side effect.
- email_send   — send an email to one or more people.
- pdf_report   — generate a PDF report (comp review, retention plan, QBR brief, save plan, etc).
- meeting_ics  — schedule a meeting (any phrasing like "schedule 1:1", "set up a sync", "book time", "get on a call"). Produces a calendar invite (.ics) and emails it to attendees.

CONTINUATION DETECTION:
  Look carefully at the conversation history. If the most recent assistant turn asked a CLARIFYING question while drafting an action (e.g. "Who should I email?", "When should this be?", "Who should be invited?"), the user's reply is a continuation of that drafting flow — even if their reply alone doesn't sound like a command.
  In that case, set is_action=true and use the action_type from the prior drafting turn.
  Carry over any entity_hint that was previously identified.

If the user mentions multiple distinct people/customers, list them comma-separated in entity_hint (e.g. "Marcus Chen, Nina Kowalski, Priya Sharma"). The downstream planner will resolve each.

Return ONLY a valid JSON object:
{{
  "is_action": true | false,
  "action_type": "task" | "email_send" | "pdf_report" | "meeting_ics" | null,
  "entity_hint": "name(s) referring to employee(s)/customer(s), comma-separated if multiple, or null"
}}"""


async def detect_action_intent(message: str, module: str, history_section: str = "") -> dict:
    """Return {is_action, action_type, entity_hint}. Cheap Haiku call."""
    if settings.mock_ai:
        lower = message.lower()
        if any(k in lower for k in ("schedule a meeting", "set up a meeting", "book time", "1:1", "1-on-1", "calendar invite")):
            return {"is_action": True, "action_type": "meeting_ics", "entity_hint": None}
        if any(k in lower for k in ("email ", "send an email", "draft an email")):
            return {"is_action": True, "action_type": "email_send", "entity_hint": None}
        if any(k in lower for k in ("schedule", "remind me", "add to my", "follow up", "create a task")):
            return {"is_action": True, "action_type": "task", "entity_hint": None}
        if any(k in lower for k in ("generate a report", "create a report", "build a pdf", "save plan")):
            return {"is_action": True, "action_type": "pdf_report", "entity_hint": None}
        return {"is_action": False, "action_type": None, "entity_hint": None}

    resp = await _claude.messages.create(
        model=settings.intent_model,
        max_tokens=128,
        messages=[{
            "role": "user",
            "content": _INTENT_DETECT_PROMPT.format(
                module=module,
                message=message,
                history_section=history_section or "(no prior turns)",
            ),
        }],
    )
    return _parse_json(resp.content[0].text)


# ──────────────────────────────────────────────────────────────────────
# plan_or_draft — clarify, or return one or more drafts
# ──────────────────────────────────────────────────────────────────────
_SLOT_REQUIREMENTS: dict[str, str] = {
    "email_send": (
        "REQUIRED slots per draft:\n"
        "  - recipients: at least one email address. Prefer the resolved entity's email.\n"
        "  - subject: a clear, concise subject line.\n"
        "  - body_markdown: 2–4 short paragraphs in markdown, professional tone.\n"
        "OPTIONAL: from_persona ('ceo' | 'manager' | 'csm' | 'system'). Default 'system'.\n"
        "Ask if you don't know who to send to OR what the email is about."
    ),
    "task": (
        "REQUIRED slots per draft:\n"
        "  - title: concise action statement.\n"
        "  - description: 1–2 sentences on what to do and why.\n"
        "OPTIONAL: due_date (YYYY-MM-DD), priority (high/medium/low), notes (any extra context).\n"
        "Tasks need a clear title and description."
    ),
    "pdf_report": (
        "REQUIRED slots per draft:\n"
        "  - report_type: comp_review | engagement_deep_dive | retention_plan | qbr_brief | save_plan | general.\n"
        "  - sections: at least 2 sections, each with 'heading' + 'body' (1–3 paragraphs of real analysis).\n"
        "Ask about focus or sections if it isn't obvious."
    ),
    "meeting_ics": (
        "REQUIRED slots per draft:\n"
        "  - title: short meeting title (e.g. '1:1 with Marcus Chen — retention check-in').\n"
        "  - attendees: at least one email address (use the entity's email if known; else ASK).\n"
        "  - start_iso: full ISO 8601 datetime (e.g. 2026-05-08T15:00:00).\n"
        "    Resolve relative phrases ('this Friday', 'tomorrow at 3pm') using today's date.\n"
        "  - description: 1–3 sentence agenda / talking points.\n"
        "OPTIONAL: duration_minutes (default 30), location ('Google Meet', 'Zoom', conference room, URL, etc).\n"
        "Ask if you don't know WHO to invite or WHEN. Don't invent a date if it's not implied."
    ),
}


_PLAN_PROMPT = """You are drafting executive AI actions of type **{action_type}**.

Today's date: {today}
Module: {module}

Known entities (already resolved against the org's database — use these emails / ids
without asking; if a name you need isn't here, ASK for the missing info):
{resolved_block}

Conversation history:
{history_section}

User's most recent message:
{message}

{slot_requirements}

CRITICAL — multi-action splitting:
  A single user request can imply MULTIPLE distinct actions.
  Examples:
    - "Schedule individual 1:1s with Marcus, Sarah, and James" → 3 separate meeting_ics drafts (one per person).
    - "Email retention messages to the 3 highest-churn customers in Enterprise" → 3 separate email_send drafts.
    - "Email Marcus about comp" → 1 email_send draft.
  Each draft is independent and gets its own approval form.
  ALWAYS wrap drafts in a list, even when there is only one.

Decide:
  IF you need clarification — return ONE short, friendly question.
  ELSE — produce a list of drafts.

Be conservative — prefer asking over inventing. Don't ask multiple questions at once. Don't ask for fields that are clearly inferrable from context.
If drafting, polish each draft fully (real subject, real body, full sections — no placeholders).

Return ONLY a valid JSON object in ONE of these two shapes:

  {{"needs_clarification": true, "question": "your single short question"}}

OR (always wrap drafts in an array, even single):
  {{"needs_clarification": false, "drafts": [<draft>, ...]}}

Per-type draft shape:

  email_send:
    {{"entity_name": "...", "title": "short action title",
      "description": "one-sentence reason this email is being sent",
      "recipients": ["email@addr"], "subject": "Email subject",
      "body_markdown": "Full email body in markdown",
      "from_persona": "ceo" | "manager" | "csm" | "system"}}

  task:
    {{"entity_name": "...", "title": "concise task title",
      "description": "1-2 sentence what+why",
      "due_date": "YYYY-MM-DD or null",
      "priority": "high" | "medium" | "low" | null,
      "notes": "any additional context, or empty string"}}

  pdf_report:
    {{"entity_name": "...", "title": "report title",
      "description": "1-sentence what this report covers",
      "report_type": "comp_review" | "engagement_deep_dive" | "retention_plan" | "qbr_brief" | "save_plan" | "general",
      "sections": [{{"heading": "...", "body": "1-3 paragraphs of real analysis"}}]}}

  meeting_ics:
    {{"entity_name": "...", "title": "meeting title",
      "description": "agenda / talking points (1-3 sentences)",
      "attendees": ["email@addr"],
      "start_iso": "2026-05-08T15:00:00",
      "duration_minutes": 30,
      "location": "Google Meet" | "Zoom" | "Conference Room A" | null}}

`entity_name` is the natural-language name (e.g., "Marcus Chen") — we resolve it
to an id by ilike match on the org's employees/customers.

No markdown, no preamble. Just the JSON."""


async def plan_or_draft(
    *,
    org_id: UUID,
    message: str,
    module: str,
    action_type: str,
    entity_hint: str | None,
    history_section: str = "",
) -> dict:
    """Returns:
      {"needs_clarification": True, "question": "..."}

      OR

      {"needs_clarification": False, "drafts": [{...}, ...]}

    Each draft has: title, description, payload, entity_type, entity_id,
    due_date (task only), priority (task only).
    """
    sb = get_supabase()

    if settings.mock_ai:
        return {"needs_clarification": False, "drafts": [_mock_draft(action_type, message, entity_hint)]}

    # Pre-resolve every entity name we can see in entity_hint so the LLM doesn't
    # have to ask for emails we already have. Intent detection sometimes passes
    # comma-separated names (multi-action requests) — handle that.
    candidate_names = [s.strip() for s in (entity_hint or "").split(",") if s.strip()]
    resolved: list[dict] = []
    for name in candidate_names:
        etype, eid, eemail = _resolve_entity(sb, org_id, module, name)
        if eid:
            resolved.append({"name": name, "type": etype, "id": eid, "email": eemail})

    if resolved:
        resolved_block = "\n".join(
            f"  - {r['name']} <{r['email'] or 'no email on file'}> ({r['type']})"
            for r in resolved
        )
    else:
        resolved_block = "  (no known entities resolved from the hint)"

    prompt = _PLAN_PROMPT.format(
        action_type=action_type,
        today=date.today().isoformat(),
        module=module,
        resolved_block=resolved_block,
        history_section=history_section or "(no prior turns)",
        message=message,
        slot_requirements=_SLOT_REQUIREMENTS.get(action_type, ""),
    )
    resp = await _claude.messages.create(
        model=settings.analyst_model,
        max_tokens=2048,  # bigger ceiling — could produce N drafts
        messages=[{"role": "user", "content": prompt}],
    )
    parsed = _parse_json(resp.content[0].text)

    if parsed.get("needs_clarification") is True:
        question = parsed.get("question") or "Could you tell me a bit more about what you'd like?"
        return {"needs_clarification": True, "question": question}

    raw_drafts = parsed.get("drafts")
    if not isinstance(raw_drafts, list) or len(raw_drafts) == 0:
        # Tolerate a single-object response shape from older prompts
        if any(k in parsed for k in ("title", "subject", "sections", "attendees")):
            raw_drafts = [parsed]
        else:
            return {
                "needs_clarification": True,
                "question": "I'm not sure exactly what to draft — could you give me a bit more detail?",
            }

    final_drafts: list[dict] = []
    for raw in raw_drafts:
        entity_type, entity_id, entity_email = _resolve_entity(
            sb, org_id, module, raw.get("entity_name") or entity_hint,
        )

        payload = _build_payload_for(action_type, raw, entity_email)
        if payload is None:
            return {
                "needs_clarification": True,
                "question": _missing_field_question(action_type, raw),
            }

        try:
            validate_payload(action_type, payload)
        except Exception as exc:
            return {
                "needs_clarification": True,
                "question": f"I had trouble structuring that action ({exc}). Could you clarify?",
            }

        final_drafts.append({
            "title": raw.get("title") or _fallback_title(action_type, message),
            "description": raw.get("description"),
            "payload": payload,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "due_date": raw.get("due_date") if action_type == "task" else None,
            "priority": raw.get("priority") if action_type == "task" else None,
        })

    return {"needs_clarification": False, "drafts": final_drafts}


def _resolve_entity(sb, org_id, module: str, name: str | None):
    """Look up an entity by name in the appropriate table.
    Returns (entity_type, entity_id, entity_email) or (None, None, None).
    """
    if not name:
        return None, None, None
    if module == "people":
        rows = (
            sb.table("employees")
            .select("id, name, email")
            .eq("org_id", str(org_id))
            .ilike("name", f"%{name}%")
            .limit(1)
            .execute().data
        )
        if rows:
            return "employee", rows[0]["id"], rows[0].get("email")
    elif module == "retention":
        rows = (
            sb.table("customers")
            .select("id, name")
            .eq("org_id", str(org_id))
            .ilike("name", f"%{name}%")
            .limit(1)
            .execute().data
        )
        if rows:
            return "customer", rows[0]["id"], None
    return None, None, None


def _build_payload_for(action_type: str, drafted: dict, entity_email: str | None) -> dict | None:
    """Map the LLM-drafted fields to the per-type payload schema.
    Returns None if a hard requirement is missing (planner should re-clarify).
    """
    if action_type == "email_send":
        recipients = drafted.get("recipients") or ([entity_email] if entity_email else [])
        recipients = [r for r in recipients if r]
        if not recipients:
            return None
        return {
            "recipients": recipients,
            "subject": drafted.get("subject") or "Follow-up from StratIQ",
            "body_markdown": drafted.get("body_markdown") or "",
            "from_persona": drafted.get("from_persona") or "system",
        }

    if action_type == "task":
        return {"notes": drafted.get("notes") or ""}

    if action_type == "pdf_report":
        sections = drafted.get("sections") or []
        if not sections:
            return None
        return {
            "report_type": drafted.get("report_type") or "general",
            "sections": sections,
        }

    if action_type == "meeting_ics":
        attendees = drafted.get("attendees") or ([entity_email] if entity_email else [])
        attendees = [a for a in attendees if a]
        start_iso = drafted.get("start_iso")
        if not attendees or not start_iso:
            return None
        return {
            "title": drafted.get("title") or "Meeting",
            "attendees": attendees,
            "start_iso": start_iso,
            "duration_minutes": drafted.get("duration_minutes") or 30,
            "description": drafted.get("description"),
            "location": drafted.get("location"),
            "send_email": True,
        }

    raise ValueError(f"Unsupported action_type: {action_type}")


def _missing_field_question(action_type: str, drafted: dict) -> str:
    """Compose a sensible follow-up if _build_payload_for returns None."""
    if action_type == "email_send":
        return "Who should I send this email to? Their email address(es), comma-separated."
    if action_type == "pdf_report":
        return "What sections should the report include? A couple of headings would help."
    if action_type == "meeting_ics":
        if not (drafted.get("attendees")):
            return "Who should be invited to this meeting? Email address(es), please."
        if not drafted.get("start_iso"):
            return "When should the meeting be? A specific date and time would help."
        return "I need a bit more info on the meeting. When and with whom?"
    return "Could you give me a bit more detail?"


# ──────────────────────────────────────────────────────────────────────
# Persist a planned draft into the actions table
# ──────────────────────────────────────────────────────────────────────
async def persist_draft(
    *,
    org_id: UUID,
    user_id: UUID,
    module: str,
    action_type: str,
    plan: dict,
    query_id: UUID | None = None,
) -> dict:
    """Insert a single row from one element of plan_or_draft's drafts list."""
    sb = get_supabase()
    tier = tier_for(action_type)
    initial_status = "draft" if tier == "low" else "pending_approval"

    row = sb.table("actions").insert({
        "org_id": str(org_id),
        "user_id": str(user_id),
        "type": action_type,
        "title": plan.get("title") or _fallback_title(action_type, ""),
        "description": plan.get("description"),
        "source_module": module,
        "source_entity_type": plan.get("entity_type"),
        "source_entity_id": plan.get("entity_id"),
        "query_id": str(query_id) if query_id else None,
        "due_date": plan.get("due_date"),
        "priority": plan.get("priority"),
        "payload": plan["payload"],
        "approval_tier": tier,
        "status": initial_status,
    }).execute().data[0]
    return row


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
def _fallback_title(action_type: str, message: str) -> str:
    snippet = (message[:60] + "…") if len(message) > 60 else message
    label = action_type.replace("_", " ").title()
    if not snippet:
        return label
    return f"{label}: {snippet}"


def _mock_draft(action_type: str, message: str, entity_hint: str | None) -> dict:
    """Mock_AI fallback. Always drafts (single), never clarifies."""
    if action_type == "email_send":
        payload = {
            "recipients": ["recipient@example.com"],
            "subject": "Following up",
            "body_markdown": f"Hi,\n\nQuick note: {message}\n\nBest,\nStratIQ",
            "from_persona": "system",
        }
    elif action_type == "task":
        payload = {"notes": "[Mock draft] enable real AI for richer drafts."}
    elif action_type == "pdf_report":
        payload = {
            "report_type": "general",
            "sections": [
                {"heading": "Summary", "body": f"This report would address: {message}"},
                {"heading": "Recommendations", "body": "Mock content. Enable real AI for analysis."},
            ],
        }
    else:  # meeting_ics
        payload = {
            "title": "Mock meeting",
            "attendees": ["attendee@example.com"],
            "start_iso": "2026-05-08T15:00:00",
            "duration_minutes": 30,
            "description": f"Mock agenda: {message}",
            "location": None,
            "send_email": True,
        }
    return {
        "title": _fallback_title(action_type, message),
        "description": "[Mock draft]",
        "payload": payload,
        "entity_type": None,
        "entity_id": None,
        "due_date": None,
        "priority": None,
    }


def _parse_json(text: str) -> dict:
    import re
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}
