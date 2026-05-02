"""
StratIQ — POST /api/ask
Main entry point. Runs the bounded multi-agent orchestration workflow.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas import AskRequest, AskResponse
from app.services.orchestrator import run_workflow_stream
from app.services.audit_service import log_event

router = APIRouter()


@router.post("/ask")
async def ask(request: AskRequest, db: AsyncSession = Depends(get_db)):
    """
    Submit a natural-language question.
    Returns an NDJSON stream of the reasoning pipeline progress.
    """
    return StreamingResponse(
        run_workflow_stream(request=request, db=db),
        media_type="application/x-ndjson"
    )
