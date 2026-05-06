"""Upload survey_responses + csm_notes fixtures directly through the running backend.

Pre-req: backend is running at http://localhost:8000 and frontend already loaded a
session for the seeded admin user (so ORG_ID is known).

Usage from backend/:
    .venv/bin/python scripts/smoke_unstructured_uploads.py <ORG_ID> <USER_ID>

It will:
  1. POST survey_responses_batch1.csv to /api/v1/uploads/
  2. Poll /api/v1/uploads/{id} until status is complete or error.
  3. Repeat for csm_notes_batch1.csv.
  4. Print the resulting uploaded_files row + a quick check on whether
     ai_analysis_runs and ai_entity_reasoning got populated for that org.

This validates the end-to-end AI workflow: CSV → signal extraction → embedding →
re-scoring → reasoning visible to the UI.
"""

import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

API_BASE = "http://localhost:8000/api/v1"
FIXTURES = {
    "survey_responses": ROOT / "test_data" / "uploads" / "survey_responses_batch1.csv",
    "csm_notes":        ROOT / "test_data" / "uploads" / "csm_notes_batch1.csv",
}


def upload(client: httpx.Client, template_type: str, path: Path, org_id: str, user_id: str) -> dict:
    print(f"\n=== Uploading {template_type} ({path.name}) ===")
    with open(path, "rb") as f:
        resp = client.post(
            f"{API_BASE}/uploads/",
            data={"template_type": template_type, "org_id": org_id, "user_id": user_id},
            files={"file": (path.name, f, "text/csv")},
            timeout=30.0,
        )
    resp.raise_for_status()
    body = resp.json()
    file_id = body["id"]
    print(f"  upload row: {file_id} (status={body['status']})")
    return body


def poll(client: httpx.Client, file_id: str, org_id: str, timeout_s: int = 120) -> dict:
    deadline = time.time() + timeout_s
    last_status = None
    while time.time() < deadline:
        r = client.get(f"{API_BASE}/uploads/{file_id}?org_id={org_id}", timeout=10.0)
        r.raise_for_status()
        body = r.json()
        if body["status"] != last_status:
            print(f"  status: {body['status']} (rows: {body.get('row_count')})")
            last_status = body["status"]
        if body["status"] in ("complete", "error"):
            return body
        time.sleep(2)
    raise TimeoutError(f"Upload {file_id} did not finish within {timeout_s}s")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python scripts/smoke_unstructured_uploads.py <ORG_ID> <USER_ID>")
        return 2
    org_id, user_id = sys.argv[1], sys.argv[2]

    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    # Snapshot the relevant tables BEFORE so we can confirm new rows post-upload.
    before_runs = sb.table("ai_analysis_runs").select("id").eq("org_id", org_id).execute().data
    before_reasoning = sb.table("ai_entity_reasoning").select("id").eq("org_id", org_id).execute().data
    print(f"Pre-upload: {len(before_runs)} analysis runs, {len(before_reasoning)} reasoning rows")

    with httpx.Client() as client:
        for template_type, path in FIXTURES.items():
            row = upload(client, template_type, path, org_id, user_id)
            poll(client, row["id"], org_id, timeout_s=180)

    after_runs = sb.table("ai_analysis_runs").select("id, module, trigger_type").eq("org_id", org_id).execute().data
    after_reasoning = sb.table("ai_entity_reasoning").select("id").eq("org_id", org_id).execute().data
    new_runs = len(after_runs) - len(before_runs)
    new_reasoning = len(after_reasoning) - len(before_reasoning)

    print(f"\nPost-upload: {len(after_runs)} runs (+{new_runs}), {len(after_reasoning)} reasoning rows (+{new_reasoning})")
    if new_runs == 0 or new_reasoning == 0:
        print("WARN  no new analysis runs or reasoning rows — re-scoring may not have triggered.")
        return 1
    print("OK    AI workflow round-trip looks healthy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
