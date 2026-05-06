"""Run just the intent + SQL steps of the pipeline so we can see whether
entity_focus and the SQL results are what build_entity_cards expects.

Run from backend/:
    .venv/bin/python scripts/probe_intent_sql.py "<ORG_ID>" "<question>"
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from app.services.ai.pipeline import _claude, _INTENT_PROMPT, _SQL_PROMPT, _parse_json  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.db.client import get_supabase  # noqa: E402


async def amain(org_id: str, question: str) -> int:
    sb = get_supabase()
    module = "people"

    # Intent
    intent_resp = await _claude.messages.create(
        model=settings.intent_model,
        max_tokens=256,
        messages=[{"role": "user", "content": _INTENT_PROMPT.format(module=module, question=question, history_section="")}],
    )
    raw = intent_resp.content[0].text
    print(f"=== Intent raw ===\n{raw}\n")
    intent = _parse_json(raw)
    print(f"=== Intent parsed ===\n{json.dumps(intent, indent=2)}\n")

    if not (intent.get("needs_sql") and intent.get("sql_hint")):
        print("FAIL  intent says no SQL needed — nothing to build cards from.")
        return 1

    # SQL
    sql_prompt = _SQL_PROMPT.format(module=module, org_id=org_id, sql_hint=intent["sql_hint"])
    sql_resp = await _claude.messages.create(
        model=settings.analyst_model,
        max_tokens=512,
        messages=[{"role": "user", "content": sql_prompt}],
    )
    sql = sql_resp.content[0].text.strip()
    print(f"=== Generated SQL ===\n{sql}\n")

    try:
        res = sb.rpc("execute_read_query", {"sql": sql}).execute()
        rows = res.data or []
    except Exception as exc:
        print(f"FAIL  execute_read_query raised: {type(exc).__name__}: {exc}")
        return 2

    print(f"=== SQL rows: {len(rows)} ===")
    if rows:
        print(f"First row keys: {list(rows[0].keys())}")
        print(f"First row: {json.dumps(rows[0], indent=2, default=str)}")
    return 0 if rows else 3


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python scripts/probe_intent_sql.py <ORG_ID> <question>")
        return 2
    org_id, question = sys.argv[1], " ".join(sys.argv[2:])
    return asyncio.run(amain(org_id, question))


if __name__ == "__main__":
    sys.exit(main())
