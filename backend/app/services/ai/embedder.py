"""
Text chunking + OpenAI embedding + pgvector storage.
Used after survey responses and CSM notes are ingested.
"""

from uuid import UUID
import openai

from app.core.config import settings
from app.db.client import get_supabase

_oai = openai.AsyncOpenAI(api_key=settings.openai_api_key)


def _chunk_text(text: str, size: int = None, overlap: int = None) -> list[str]:
    size = size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i:i + size]))
        i += size - overlap
    return [c for c in chunks if c.strip()]


async def embed_and_store(
    *,
    text: str,
    source_type: str,
    source_id: str,
    entity_type: str,
    entity_id: str,
    org_id: UUID,
    metadata: dict | None = None,
) -> None:
    chunks = _chunk_text(text)
    if not chunks:
        return

    response = await _oai.embeddings.create(
        model=settings.embedding_model,
        input=chunks,
        dimensions=settings.embedding_dimensions,
    )

    sb = get_supabase()
    rows = [
        {
            "org_id": str(org_id),
            "source_type": source_type,
            "source_id": source_id,
            "content": chunk,
            "embedding": emb.embedding,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": {**(metadata or {}), "chunk_index": i, "total_chunks": len(chunks)},
        }
        for i, (chunk, emb) in enumerate(zip(chunks, response.data))
    ]
    sb.table("document_chunks").insert(rows).execute()


async def similarity_search(
    *,
    query_text: str,
    org_id: UUID,
    entity_type: str | None = None,
    entity_ids: list[str] | None = None,
    top_k: int | None = None,
) -> list[dict]:
    top_k = top_k or settings.rag_top_k

    emb_response = await _oai.embeddings.create(
        model=settings.embedding_model,
        input=[query_text],
        dimensions=settings.embedding_dimensions,
    )
    query_vector = emb_response.data[0].embedding

    # Use Supabase RPC for pgvector cosine similarity with optional entity filter
    params: dict = {
        "query_embedding": query_vector,
        "org_id_param": str(org_id),
        "top_k": top_k,
    }
    if entity_type:
        params["entity_type_param"] = entity_type
    if entity_ids:
        params["entity_ids_param"] = entity_ids

    sb = get_supabase()
    result = sb.rpc("match_document_chunks", params).execute()
    return result.data or []
