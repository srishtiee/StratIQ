"""Run the pipeline up to the response generation step and dump the EXACT
prompt sent to Claude — so we can see whether rag_context is empty or
populated, and whether the prompt forbidding "I don't have access" is live.

Run from backend/:
    .venv/bin/python scripts/probe_response_prompt.py "<ORG_ID>" "<question>"
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

from app.core.config import settings  # noqa: E402
from app.services.ai.embedder import similarity_search  # noqa: E402
from app.services.ai.pipeline import (  # noqa: E402
    _claude, _INTENT_PROMPT, _RESPONSE_PROMPT, _parse_json,
    _format_rag_context_with_attribution,
)
from app.services.ai.context_injector import inject_context  # noqa: E402
from app.db.client import get_supabase  # noqa: E402


async def amain(org_id: str, user_id: str, question: str) -> int:
    sb = get_supabase()
    module = "people"

    # Intent
    intent_resp = await _claude.messages.create(
        model=settings.intent_model,
        max_tokens=256,
        messages=[{"role": "user", "content": _INTENT_PROMPT.format(module=module, question=question, history_section="")}],
    )
    intent = _parse_json(intent_resp.content[0].text)
    print(f"intent.needs_rag = {intent.get('needs_rag')}")
    print(f"intent.entity_focus = {intent.get('entity_focus')}")

    # RAG
    rag_chunks = []
    if intent.get("needs_rag"):
        rag_chunks = await similarity_search(
            query_text=question,
            org_id=UUID(org_id),
            entity_type=intent.get("entity_focus") if intent.get("entity_focus") in ("employee", "customer") else None,
        )
    print(f"rag_chunks fetched: {len(rag_chunks)}")
    print(f"settings.rag_top_k = {settings.rag_top_k}")

    rag_context = _format_rag_context_with_attribution(sb, org_id, rag_chunks[:settings.rag_top_k])
    print(f"rag_context length (chars): {len(rag_context)}")
    print(f"rag_context preview: {rag_context[:300]!r}…")

    # Org context
    global_context = await inject_context(org_id=UUID(org_id), user_id=UUID(user_id), module=module)

    # Build the actual response prompt
    response_prompt = _RESPONSE_PROMPT.format(
        module=module,
        question=question,
        global_context=global_context or "(no broader context available)",
        history_section="",
        sql_results=json.dumps([], default=str),
        rag_context=rag_context or "No relevant documents found.",
    )

    print("\n=== RESPONSE PROMPT (first 1500 chars) ===")
    print(response_prompt[:1500])
    print("\n=== RESPONSE PROMPT (last 800 chars) ===")
    print(response_prompt[-800:])

    # Quick check: is the new prompt rule there?
    if "Critical: if the rag_context section contains real document content" in response_prompt:
        print("\nOK    new no-refusal rule is in the prompt.")
    else:
        print("\nFAIL  new no-refusal rule NOT in the prompt — backend module is stale, restart needed.")

    return 0


def main() -> int:
    if len(sys.argv) < 4:
        print("Usage: python scripts/probe_response_prompt.py <ORG_ID> <USER_ID> <question>")
        return 2
    org_id, user_id, question = sys.argv[1], sys.argv[2], " ".join(sys.argv[3:])
    return asyncio.run(amain(org_id, user_id, question))


if __name__ == "__main__":
    sys.exit(main())
