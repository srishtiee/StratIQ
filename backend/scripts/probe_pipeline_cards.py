"""Stream the AI pipeline for a sample 'who is at risk?' question and report
exactly which SSE events fire — specifically whether `entity_cards` shows up.

Run from backend/:
    .venv/bin/python scripts/probe_pipeline_cards.py "<ORG_ID>" "<USER_ID>" "<question>"
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from app.services.ai.pipeline import run_query_pipeline  # noqa: E402
from app.services.ai.entity_cards import build_entity_cards  # noqa: E402
from app.db.client import get_supabase  # noqa: E402


async def amain(org_id: str, user_id: str, question: str) -> int:
    print(f"\n=== Streaming pipeline for: {question!r} ===\n")
    counts: dict[str, int] = {}
    last_status: str | None = None
    entity_cards_payload: list | None = None

    async for chunk in run_query_pipeline(
        org_id=UUID(org_id),
        user_id=UUID(user_id),
        module="people" if "employee" in question.lower() or "attrition" in question.lower() or "leav" in question.lower() else "retention",
        question=question,
    ):
        # SSE format: "event: foo\ndata: {...}\n\n"
        for line in chunk.split("\n"):
            if line.startswith("event: "):
                ev = line[7:].strip()
                counts[ev] = counts.get(ev, 0) + 1
                if ev == "status":
                    last_status = ev
            elif line.startswith("data: "):
                if last_status == "status":
                    msg = json.loads(line[6:])
                    print(f"  status: {msg.get('step')} — {msg.get('message')}")
                    last_status = None
                elif "entity_cards" in counts and counts.get("entity_cards") and entity_cards_payload is None:
                    try:
                        d = json.loads(line[6:])
                        if isinstance(d, dict) and "cards" in d:
                            entity_cards_payload = d["cards"]
                    except Exception:
                        pass

    print("\nEvent counts:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print()
    if "entity_cards" not in counts:
        print("FAIL  no entity_cards event emitted.")
        print("       Diagnosis pointers:")
        print("       1) Intent router probably classified entity_focus != employee/customer.")
        print("       2) Or SQL execution returned no rows (check execute_read_query RPC + generated SQL).")
        return 1

    print(f"OK    entity_cards event fired with {len(entity_cards_payload or [])} cards.")
    if entity_cards_payload:
        print("First card:")
        print(json.dumps(entity_cards_payload[0], indent=2, default=str))
    return 0


def main() -> int:
    if len(sys.argv) < 4:
        print("Usage: python scripts/probe_pipeline_cards.py <ORG_ID> <USER_ID> <question>")
        return 2
    org_id, user_id, question = sys.argv[1], sys.argv[2], " ".join(sys.argv[3:])
    return asyncio.run(amain(org_id, user_id, question))


if __name__ == "__main__":
    sys.exit(main())
