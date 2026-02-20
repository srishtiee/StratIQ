from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from typing import Literal
from uuid import UUID

from app.services.data.upload_processor import process_upload
from app.schemas.uploads import UploadedFileOut

router = APIRouter()

TemplateType = Literal[
    "employees", "compensation", "compensation_bands",
    "customers", "churn_signals",
    "survey_responses", "csm_notes", "kpis",
]


@router.post("/", response_model=UploadedFileOut, status_code=202)
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    template_type: TemplateType = Form(...),
    org_id: UUID = Form(...),
    user_id: UUID = Form(...),
    round_id: UUID | None = Form(None),
):
    """Accept a CSV/XLSX upload, persist to Supabase Storage, and kick off background processing."""
    if file.content_type not in {
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
    }:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    content = await file.read()
    result = await process_upload(
        content=content,
        filename=file.filename or "upload",
        template_type=template_type,
        org_id=org_id,
        user_id=user_id,
        round_id=round_id,
        background_tasks=background_tasks,
    )
    return result


@router.get("/")
async def list_uploads(org_id: UUID, limit: int = 50):
    """List recent uploads for the org."""
    from app.db.client import get_supabase
    sb = get_supabase()
    return (
        sb.table("uploaded_files")
        .select("*")
        .eq("org_id", str(org_id))
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


@router.get("/{file_id}", response_model=UploadedFileOut)
async def get_upload_status(file_id: UUID, org_id: UUID):
    """Poll the status of an in-progress upload."""
    from app.db.client import get_supabase, fetch_one
    sb = get_supabase()
    row = fetch_one(
        sb.table("uploaded_files").select("*").eq("id", str(file_id)).eq("org_id", str(org_id))
    )
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")
    return row
