"""Diagnose why RAG returns 0 results for a question.

Checks:
  1. Are there `survey_responses` rows for the org?
  2. Are there `document_chunks` rows with non-null embeddings?
  3. Does the `match_document_chunks` RPC return anything for a sample query?
  4. End-to-end: similarity_search() with the user's actual question.

Run from backend/:
    .venv/bin/python scripts/probe_rag.py "<ORG_ID>" "<question>"
"""

import asyncio
import os
import sys
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from supabase import create_client  # noqa: E402
from app.services.ai.embedder import similarity_search  # noqa: E402


async def amain(org_id: str, question: str) -> int:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    # 1) survey_responses
    sr = sb.table("survey_responses").select("id, employee_id, raw_text, processed_at").eq("org_id", org_id).execute().data or []
    print(f"survey_responses rows: {len(sr)}")
    if sr:
        print(f"  first raw_text: {sr[0]['raw_text'][:120]}…")
        print(f"  first processed_at: {sr[0]['processed_at']}")

    # 2) csm_notes
    csm = sb.table("csm_notes").select("id, customer_id, raw_text, processed_at").eq("org_id", org_id).execute().data or []
    print(f"csm_notes rows: {len(csm)}")
    if csm:
        print(f"  first raw_text: {csm[0]['raw_text'][:120]}…")

    # 3) document_chunks
    chunks = sb.table("document_chunks").select("id, source_type, source_id, entity_type, entity_id, content, embedding", count="exact").eq("org_id", org_id).limit(5).execute()
    total_chunks = chunks.count
    print(f"document_chunks total: {total_chunks}")
    if chunks.data:
        sample = chunks.data[0]
        emb = sample.get("embedding")
        print(f"  first chunk source_type: {sample['source_type']}, entity_type: {sample['entity_type']}")
        print(f"  first chunk content: {(sample['content'] or '')[:120]}…")
        print(f"  first chunk embedding present: {emb is not None and len(emb) > 0 if isinstance(emb, list) else bool(emb)}")
        if isinstance(emb, str):
            print(f"  first chunk embedding TYPE IS STRING (len={len(emb)}) — pgvector returns string repr, fine")

    # 4) Try similarity_search end-to-end
    print(f"\n=== similarity_search('{question}', org={org_id}) ===")
    results = await similarity_search(query_text=question, org_id=UUID(org_id))
    print(f"  results: {len(results)}")
    for r in results[:3]:
        print(f"    - source_type={r.get('source_type')}, entity_type={r.get('entity_type')}, content={(r.get('content') or '')[:100]!r}")

    # 5) Same with entity_type="employee" filter (the pipeline does this for entity_focus=employee)
    print(f"\n=== similarity_search(filter=employee) ===")
    results_emp = await similarity_search(query_text=question, org_id=UUID(org_id), entity_type="employee")
    print(f"  results: {len(results_emp)}")
    for r in results_emp[:3]:
        print(f"    - entity_id={r.get('entity_id')}, content={(r.get('content') or '')[:100]!r}")

    return 0


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python scripts/probe_rag.py <ORG_ID> <question>")
        return 2
    return asyncio.run(amain(sys.argv[1], " ".join(sys.argv[2:])))


if __name__ == "__main__":
    sys.exit(main())
