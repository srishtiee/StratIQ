"""Reproduce the 'delete chat doesn't work' bug.

Picks the most-recent chat_session that has at least one query referenced by
an action (the FK chain that probably blocks the cascade), then attempts to
delete it via the same Supabase client the backend uses.

Run from backend/:
    .venv/bin/python scripts/probe_delete_session.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")


def main() -> int:
    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    queries_with_actions = (
        sb.table("actions")
        .select("query_id")
        .not_.is_("query_id", None)
        .limit(50)
        .execute()
        .data
        or []
    )
    candidate_query_ids = list({q["query_id"] for q in queries_with_actions if q.get("query_id")})
    if not candidate_query_ids:
        print("No queries with linked actions found — pick any chat_session manually.")
        return 1
    print(f"Found {len(candidate_query_ids)} query rows referenced by actions.")

    session_rows = (
        sb.table("queries")
        .select("session_id, id")
        .in_("id", candidate_query_ids)
        .not_.is_("session_id", None)
        .execute()
        .data
        or []
    )
    sessions = list({r["session_id"] for r in session_rows if r.get("session_id")})
    if not sessions:
        print("No sessions found that contain linked queries.")
        return 1
    sid = sessions[0]
    print(f"Trying to delete session {sid}…")

    try:
        res = sb.table("chat_sessions").delete().eq("id", sid).execute()
        print(f"Delete returned data: {res.data}")
    except Exception as exc:
        print(f"FAIL  {type(exc).__name__}: {exc}")
        return 2

    still_there = sb.table("chat_sessions").select("id").eq("id", sid).execute().data
    if still_there:
        print(f"FAIL  session {sid} is STILL in chat_sessions — delete silently blocked.")
        return 3
    print(f"OK    session {sid} actually gone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
