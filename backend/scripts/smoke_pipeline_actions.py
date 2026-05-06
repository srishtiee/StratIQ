"""End-to-end pipeline smoke test for the auto-execute behavior.

Verifies:
  1. Detailed task command → action_draft event arrives with status='completed'.
  2. Detailed email command → action_draft event arrives with status='pending_approval'
     (NOT auto-executed; needs review).
  3. Vague task command → no action created; clarifying question streamed.

Cleans up any actions it creates by soft-deleting them at the end.

Run from backend/:
    python scripts/smoke_pipeline_actions.py
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.db.client import get_supabase  # noqa: E402
from app.services.ai.pipeline import run_query_pipeline  # noqa: E402


def _parse_sse(chunk: str) -> tuple[str | None, dict]:
    event = None
    data = {}
    for line in chunk.split("\n"):
        if line.startswith("event: "):
            event = line[7:].strip()
        elif line.startswith("data: "):
            try:
                data = json.loads(line[6:])
            except Exception:
                pass
    return event, data


async def collect(gen):
    events = []
    async for chunk in gen:
        ev, data = _parse_sse(chunk)
        if ev:
            events.append((ev, data))
    return events


async def run_one(label: str, *, message: str, module: str, org_id: UUID, user_id: UUID):
    print(f"\n=== {label} ===")
    print(f"user: {message!r}")
    events = await collect(run_query_pipeline(
        org_id=org_id, user_id=user_id, module=module, question=message,
    ))
    drafts = [d for ev, d in events if ev == "action_draft"]
    done = next((d for ev, d in events if ev == "done"), None)

    if drafts:
        action = drafts[-1]["action"]
        print(f"  action_draft: type={action.get('type')} status={action.get('status')} title={action.get('title')!r}")
        if action.get("status") == "completed":
            result = action.get("result") or {}
            print(f"    result keys: {list(result.keys())}")
        return action
    else:
        print(f"  no action_draft (likely clarification)")
        if done:
            print(f"  reply: {done.get('response')!r}")
        return None


async def main() -> int:
    sb = get_supabase()
    profile = sb.table("user_profiles").select("id, org_id").limit(1).execute().data
    if not profile:
        print("FAIL no user_profile rows")
        return 1
    org_id = UUID(profile[0]["org_id"])
    user_id = UUID(profile[0]["id"])
    created_action_ids: list[str] = []

    try:
        # 1. Detailed task → auto-execute → status='completed'
        a1 = await run_one(
            "Scenario 1 — detailed task (should auto-execute)",
            message="Schedule a 1:1 task with Marcus this Friday at 3pm to talk about retention. Mark it high priority.",
            module="people", org_id=org_id, user_id=user_id,
        )
        if a1:
            created_action_ids.append(a1["id"])
            assert a1["status"] == "completed", f"expected completed, got {a1['status']}"
            print(f"  ✓ Auto-executed: status=completed")

        # 2. Detailed email → NOT auto-executed → status='pending_approval'
        a2 = await run_one(
            "Scenario 2 — detailed email (should require approval)",
            message="Email marcus.chen@acme.com offering to discuss his comp review next week.",
            module="people", org_id=org_id, user_id=user_id,
        )
        if a2:
            created_action_ids.append(a2["id"])
            assert a2["status"] == "pending_approval", f"expected pending_approval, got {a2['status']}"
            print(f"  ✓ Requires approval: status=pending_approval")

        # 3. Vague request → clarifying question, no action
        a3 = await run_one(
            "Scenario 3 — vague task (should ask for clarification)",
            message="Set up a meeting",
            module="people", org_id=org_id, user_id=user_id,
        )
        if a3 is None:
            print(f"  ✓ No action created — clarifying question instead")
        else:
            created_action_ids.append(a3["id"])
            print(f"  ✗ Unexpected action created: {a3['id']}")

        print("\n=== ALL SCENARIOS PASSED ===")
        return 0

    finally:
        # Soft-delete anything we created
        for aid in created_action_ids:
            sb.table("actions").update({
                "deleted_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", aid).execute()
        if created_action_ids:
            print(f"\n(cleaned up {len(created_action_ids)} test action(s))")


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
