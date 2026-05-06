"""Probe whether the seeded user can read their own user_profiles row via the anon key.

This mimics what the frontend's AuthBridge does after Supabase login.
If RLS blocks it, the frontend will never resolve org_id and all hooks stay disabled.

Run from backend/:
    .venv/bin/python scripts/probe_rls.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")

SEED_EMAIL = "srishti.bankar@acme.com"
SEED_PASSWORD = "StratIQ2026!"


def main() -> int:
    url = os.environ["SUPABASE_URL"]
    anon = os.environ["SUPABASE_ANON_KEY"]
    service = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    sb_anon = create_client(url, anon)

    print(f"Signing in as {SEED_EMAIL}…")
    auth_resp = sb_anon.auth.sign_in_with_password({"email": SEED_EMAIL, "password": SEED_PASSWORD})
    if not auth_resp.user:
        print("FAIL  sign_in_with_password returned no user")
        return 1
    user_id = auth_resp.user.id
    print(f"  signed in as {user_id}")

    print("\nReading user_profiles row via anon-key client (post-login)…")
    try:
        r = sb_anon.table("user_profiles").select("id, org_id, name, role").eq("id", user_id).execute()
        rows = r.data or []
        if not rows:
            print("FAIL  empty result — RLS likely blocking the read")
            print("      this is why the frontend can't hydrate orgId after login")
            return 2
        print(f"OK    got row: {rows[0]}")
    except Exception as exc:
        print(f"FAIL  {type(exc).__name__}: {exc}")
        return 3

    sb_anon.auth.sign_out()
    return 0


if __name__ == "__main__":
    sys.exit(main())
