"""End-to-end smoke test for the slot-filling action planner.

Tests three scenarios against real Claude:
  1. Vague request → expect a clarifying question (no draft).
  2. Detailed request → expect a fully-drafted action.
  3. Continuation: vague request, then a follow-up that fills the gap → expect a draft.

No DB writes for the action itself (we don't call persist_draft).

Run from backend/:
    python scripts/smoke_action_planner.py
"""

import asyncio
import os
import sys
import json
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Need to be after dotenv load so settings sees MOCK_AI=false
from app.services.ai.action_creator import detect_action_intent, plan_or_draft  # noqa: E402
from app.db.client import get_supabase  # noqa: E402


async def main() -> int:
    # Pick any org id we have in the live DB (planner just uses it for entity lookup)
    sb = get_supabase()
    profile = sb.table("user_profiles").select("id, org_id").limit(1).execute().data
    if not profile:
        print("FAIL no user_profile rows in Supabase")
        return 1
    org_id = profile[0]["org_id"]

    # ────────────────────────────────────────────────────────────
    # Scenario 1 — vague request
    # ────────────────────────────────────────────────────────────
    print("\n=== Scenario 1 — vague: 'Email someone' ===")
    intent1 = await detect_action_intent("Email someone about the comp issue", "people", "")
    print(f"intent: {intent1}")
    plan1 = await plan_or_draft(
        org_id=org_id,
        message="Email someone about the comp issue",
        module="people",
        action_type="email_send",
        entity_hint=intent1.get("entity_hint"),
        history_section="",
    )
    if plan1.get("needs_clarification"):
        print(f"  ✓ Needs clarification: {plan1['question']!r}")
    else:
        print(f"  ✗ Drafted unexpectedly: title={plan1.get('title')!r}")

    # ────────────────────────────────────────────────────────────
    # Scenario 2 — detailed request
    # ────────────────────────────────────────────────────────────
    print("\n=== Scenario 2 — detailed: 'Schedule a 1:1 task with Marcus this Friday about retention' ===")
    intent2 = await detect_action_intent(
        "Schedule a 1:1 task with Marcus this Friday to talk about his retention concerns",
        "people", "",
    )
    print(f"intent: {intent2}")
    plan2 = await plan_or_draft(
        org_id=org_id,
        message="Schedule a 1:1 task with Marcus this Friday to talk about his retention concerns",
        module="people",
        action_type="task",
        entity_hint=intent2.get("entity_hint"),
        history_section="",
    )
    if plan2.get("needs_clarification"):
        print(f"  · Asked for clarification: {plan2['question']!r}")
    else:
        print(f"  ✓ Drafted: title={plan2.get('title')!r}")
        print(f"    payload={json.dumps(plan2.get('payload'), indent=6)}")
        print(f"    due_date={plan2.get('due_date')} priority={plan2.get('priority')}")

    # ────────────────────────────────────────────────────────────
    # Scenario 3 — continuation flow
    # ────────────────────────────────────────────────────────────
    print("\n=== Scenario 3 — continuation: vague → user replies with detail ===")
    history = (
        "Conversation history (oldest first):\n"
        "User: Email Sarah\n"
        "Assistant: What should the email be about, and to which Sarah?\n"
    )
    cont_msg = "Sarah Mitchell. About scheduling her promotion review for next quarter."
    intent3 = await detect_action_intent(cont_msg, "people", history)
    print(f"continuation intent: {intent3}")
    if not intent3.get("is_action"):
        print("  ✗ Continuation not detected — model treated it as a plain reply.")
    else:
        plan3 = await plan_or_draft(
            org_id=org_id,
            message=cont_msg,
            module="people",
            action_type=intent3["action_type"],
            entity_hint=intent3.get("entity_hint"),
            history_section=history,
        )
        if plan3.get("needs_clarification"):
            print(f"  · Asked for clarification: {plan3['question']!r}")
        else:
            print(f"  ✓ Drafted after continuation: title={plan3.get('title')!r}")
            print(f"    payload={json.dumps(plan3.get('payload'), indent=6)}")

    print("\n=== DONE ===")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
