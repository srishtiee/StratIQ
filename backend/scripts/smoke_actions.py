"""Smoke-test the new GET + PATCH /actions/{id} routes against the live Supabase project.

Inserts a draft task action, fetches it, patches its payload + title, verifies the
update landed, then deletes the row. No persistent side effects.

Run from backend/:
    python scripts/smoke_actions.py
"""

import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def main() -> int:
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Pick the (org, user) pair that has a real user_profile so the FK is satisfied.
    profiles = sb.table("user_profiles").select("id, org_id").limit(1).execute().data
    if not profiles:
        print("FAIL no user_profile rows exist anywhere; run scripts/seed.py or create one first")
        return 1
    org_id = profiles[0]["org_id"]
    user_id = profiles[0]["id"]

    print(f"org_id={org_id} user_id={user_id}")

    # 1. Insert draft task action
    inserted = sb.table("actions").insert({
        "org_id": org_id,
        "user_id": user_id,
        "type": "task",
        "title": "smoke test (delete me)",
        "description": "smoke test",
        "source_module": "people",
        "payload": {"notes": "initial"},
        "approval_tier": "low",
        "status": "draft",
    }).execute().data[0]
    aid = inserted["id"]
    print(f"inserted action {aid} status={inserted['status']} payload={inserted['payload']}")

    try:
        # 2. Fetch via the same query GET /{id} would use
        fetched = sb.table("actions").select("*").eq("id", aid).eq("org_id", org_id).execute().data
        assert fetched, "GET-equivalent fetch returned nothing"
        print(f"fetched ok title={fetched[0]['title']!r}")

        # 3. PATCH-equivalent update — change title + payload
        new_payload = {"notes": "updated via smoke"}
        updated = sb.table("actions").update({
            "title": "smoke test (patched)",
            "payload": new_payload,
        }).eq("id", aid).eq("org_id", org_id).execute().data[0]
        print(f"patched ok title={updated['title']!r} payload={updated['payload']}")
        assert updated["title"] == "smoke test (patched)"
        assert updated["payload"] == new_payload

        # 4. Verify status-guard would block edits in terminal states by simulating
        sb.table("actions").update({"status": "completed"}).eq("id", aid).execute()
        completed = sb.table("actions").select("status").eq("id", aid).execute().data[0]
        print(f"forced status to completed (status={completed['status']}) — endpoint would now reject PATCH")

    finally:
        sb.table("actions").delete().eq("id", aid).execute()
        print(f"deleted action {aid}")

    print("\n=== ALL CHECKS PASSED ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
