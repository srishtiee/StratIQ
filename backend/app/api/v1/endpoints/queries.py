from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from uuid import UUID
from typing import Literal

from app.services.ai.pipeline import run_query_pipeline
from app.db.client import get_supabase, fetch_one

router = APIRouter()


class QueryRequest(BaseModel):
    org_id: UUID
    user_id: UUID
    module: Literal["people", "retention"]
    question: str
    session_id: UUID | None = None


@router.post("/")
async def ask(body: QueryRequest):
    """
    Run the AI query pipeline and stream the response.

    If session_id is omitted a new chat_sessions row is created. Prior turns in
    the session are pulled and threaded into the intent + response prompts.

    Pipeline: Intent Router → (Action fork) → SQL Analyst → Data Executor
              → RAG Retriever → Context Injector → Response Generator
              → Critic → Refiner → Action Planner

    The Analytics Engine step from the master plan is not yet implemented;
    SQL results flow directly into the Response Generator.
    """
    return StreamingResponse(
        run_query_pipeline(
            org_id=body.org_id,
            user_id=body.user_id,
            module=body.module,
            question=body.question,
            session_id=body.session_id,
        ),
        media_type="text/event-stream",
    )


@router.get("/history")
async def query_history(org_id: UUID, user_id: UUID, limit: int = 20):
    """Flat list of recent queries — kept for backwards compatibility."""
    sb = get_supabase()
    rows = (
        sb.table("queries")
        .select("id, session_id, question, response, sources, created_at")
        .eq("org_id", str(org_id))
        .eq("user_id", str(user_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return rows.data


@router.get("/sessions")
async def list_sessions(org_id: UUID, user_id: UUID, module: str | None = None, limit: int = 50):
    """List chat sessions for the user, most recently active first."""
    sb = get_supabase()
    q = (
        sb.table("chat_sessions")
        .select("id, module, title, created_at, updated_at")
        .eq("org_id", str(org_id))
        .eq("user_id", str(user_id))
        .order("updated_at", desc=True)
        .limit(limit)
    )
    if module:
        q = q.eq("module", module)
    return q.execute().data


@router.get("/sessions/{session_id}")
async def get_session(session_id: UUID, org_id: UUID):
    """Return one session with its full turn history (oldest first)."""
    sb = get_supabase()
    session = fetch_one(
        sb.table("chat_sessions").select("id, module, title, created_at, updated_at")
        .eq("id", str(session_id)).eq("org_id", str(org_id))
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    turns = (
        sb.table("queries")
        .select("id, question, response, sources, created_at")
        .eq("session_id", str(session_id))
        .order("created_at", desc=False)
        .execute()
        .data
    )
    return {"session": session, "turns": turns}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: UUID, org_id: UUID):
    """Delete a session and (via FK cascade) its queries."""
    sb = get_supabase()
    sb.table("chat_sessions").delete().eq("id", str(session_id)).eq("org_id", str(org_id)).execute()
    return {"deleted": True}
