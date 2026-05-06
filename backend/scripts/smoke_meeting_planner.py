"""Smoke-test the planner for meeting + multi-action.

Scenarios:
  1. Single meeting request → 1 meeting_ics draft, fully populated.
  2. Multi-action request → multiple drafts (one per attendee).
  3. Vague meeting request → clarification.

No DB writes for actions (skips persist_draft + execute).
"""

import asyncio
import json
import sys
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.db.client import get_supabase  # noqa: E402
from app.services.ai.action_creator import detect_action_intent, plan_or_draft  # noqa: E402


async def run(label: str, *, message: str, module: str, org_id: UUID):
    print(f"\n=== {label} ===")
    print(f"user: {message!r}")
    intent = await detect_action_intent(message, module, "")
    print(f"  intent: {intent}")
    if not intent.get("is_action"):
        print("  ✗ Not detected as action")
        return
    plan = await plan_or_draft(
        org_id=org_id,
        message=message,
        module=module,
        action_type=intent["action_type"],
        entity_hint=intent.get("entity_hint"),
        history_section="",
    )
    if plan.get("needs_clarification"):
        print(f"  · Asked for clarification: {plan['question']!r}")
        return
    drafts = plan.get("drafts", [])
    print(f"  ✓ Drafted {len(drafts)} action(s) of type={intent['action_type']}")
    for i, d in enumerate(drafts):
        print(f"  draft #{i + 1}:")
        print(f"    title:    {d.get('title')!r}")
        print(f"    entity:   {d.get('entity_type')} / {d.get('entity_id')}")
        payload = d.get("payload", {})
        if intent["action_type"] == "meeting_ics":
            print(f"    attendees: {payload.get('attendees')}")
            print(f"    start_iso: {payload.get('start_iso')}")
            print(f"    duration:  {payload.get('duration_minutes')}")
            print(f"    location:  {payload.get('location')}")


async def main() -> int:
    sb = get_supabase()
    profile = sb.table("user_profiles").select("id, org_id").limit(1).execute().data
    if not profile:
        print("FAIL no user_profile rows")
        return 1
    org_id = UUID(profile[0]["org_id"])

    await run(
        "Scenario 1 — single meeting",
        message="Schedule a 1:1 meeting with Marcus Chen this Friday at 3pm to talk about retention. 30 minutes.",
        module="people", org_id=org_id,
    )

    await run(
        "Scenario 2 — multi-action (3 separate 1:1s)",
        message="Schedule individual 30-minute 1:1s with Marcus Chen, Nina Kowalski, and Priya Sharma next Tuesday afternoon, staggered an hour apart starting at 1pm.",
        module="people", org_id=org_id,
    )

    await run(
        "Scenario 3 — vague meeting",
        message="Set up a meeting",
        module="people", org_id=org_id,
    )

    print("\n=== DONE ===")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
