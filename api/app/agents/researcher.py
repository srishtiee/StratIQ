"""
StratIQ — Researcher Agent
Retrieves unstructured evidence via pgvector similarity search.
Falls back to keyword-based retrieval if embeddings are not yet generated.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..schemas import AskRequest, EvidenceItem
from ..config import settings


class ResearcherAgent:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def run(self, request: AskRequest) -> dict:
        """
        1. Attempt vector similarity search (if embeddings exist).
        2. Fall back to full-text keyword search if no embeddings.
        """
        evidence = []

        # Check if any embeddings exist
        has_embeddings = await self.db.execute(
            text("SELECT EXISTS(SELECT 1 FROM document_chunks WHERE embedding IS NOT NULL)")
        )
        embeddings_available = has_embeddings.scalar()

        if embeddings_available:
            evidence = await self._vector_search(request.question)
        else:
            evidence = await self._keyword_search(request.question)

        summary = (
            f"Retrieved {len(evidence)} evidence snippets. "
            + (f"Top source: {evidence[0].source_title}." if evidence else "No relevant documents found.")
        )

        return {
            "evidence": [e.model_dump() for e in evidence],
            "summary": summary,
            "retrieval_method": "vector" if embeddings_available else "keyword",
        }

    async def _vector_search(self, question: str) -> list[EvidenceItem]:
        """Cosine similarity search using pgvector."""
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.embeddings.create(
            model=settings.embedding_model, input=question
        )
        q_vec = response.data[0].embedding

        result = await self.db.execute(text("""
            SELECT source_type, source_title, content, metadata,
                   1 - (embedding <=> CAST(:vec AS vector)) AS relevance_score
            FROM document_chunks
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :k
        """), {"vec": str(q_vec), "k": settings.rag_top_k})
        rows = result.mappings().all()

        return [
            EvidenceItem(
                source_type=r["source_type"],
                source_title=r["source_title"],
                snippet=r["content"][:400],
                relevance_score=round(float(r["relevance_score"]), 3),
                metadata=r["metadata"] or {},
            )
            for r in rows
        ]

    async def _keyword_search(self, question: str) -> list[EvidenceItem]:
        """Fallback: simple ILIKE keyword search when no embeddings exist."""
        keywords = [w for w in question.split() if len(w) > 3][:5]
        params = {"k": settings.rag_top_k}
        if keywords:
            clauses = []
            for i, kw in enumerate(keywords):
                key = f"kw_{i}"
                clauses.append(f"content ILIKE :{key}")
                params[key] = f"%{kw}%"
            where_sql = " OR ".join(clauses)
        else:
            where_sql = "TRUE"

        result = await self.db.execute(text(f"""
            SELECT source_type, source_title, content, metadata
            FROM document_chunks
            WHERE {where_sql}
            LIMIT :k
        """), params)
        rows = result.mappings().all()

        return [
            EvidenceItem(
                source_type=r["source_type"],
                source_title=r["source_title"],
                snippet=r["content"][:400],
                relevance_score=0.5,
                metadata=r["metadata"] or {},
            )
            for r in rows
        ]
