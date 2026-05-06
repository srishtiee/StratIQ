"""Probe live Supabase to check whether 003 and 004 migrations are applied.

Run from backend/:
    python scripts/probe_migrations.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")


def main() -> int:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("FAIL  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        return 1
    sb = create_client(url, key)

    print("=== 003_actions_soft_delete ===")
    try:
        row = sb.table("actions").select("*").limit(1).execute().data
        if not row:
            print("WARN  actions table is empty; cannot read columns from data. Trying insert-probe is risky; skipping.")
            print("      If the table is truly empty, apply 003 manually and rerun.")
        else:
            cols = list(row[0].keys())
            has_deleted_at = "deleted_at" in cols
            has_approval_tier = "approval_tier" in cols
            print(f"OK    deleted_at present: {has_deleted_at}")
            print(f"      approval_tier present: {has_approval_tier} (sanity-check for 002)")
            print(f"      column count: {len(cols)}")
    except Exception as exc:
        print(f"FAIL  {type(exc).__name__}: {exc}")

    print()
    print("=== 004_meeting_ics_type ===")
    try:
        sb.table("actions").insert({
            "org_id": "00000000-0000-0000-0000-000000000000",
            "user_id": "00000000-0000-0000-0000-000000000000",
            "type": "meeting_ics",
            "status": "draft",
            "title": "__probe__",
        }).execute()
        print("UNEXPECTED  insert succeeded with placeholder org_id; inspect manually")
    except Exception as exc:
        msg = str(exc).lower()
        if "actions_type_check" in msg or "violates check constraint" in msg and "type" in msg:
            print("FAIL  meeting_ics rejected by CHECK constraint -> 004 NOT applied")
        elif "foreign key" in msg or "violates foreign key" in msg or "is not present" in msg:
            print("OK    meeting_ics passed CHECK; rejected by FK only -> 004 IS applied")
        elif "row-level security" in msg or "rls" in msg or "permission" in msg:
            print("INDETERMINATE  blocked by RLS before CHECK; manual verification needed")
            print(f"               error: {exc}")
        else:
            print(f"INDETERMINATE  {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
