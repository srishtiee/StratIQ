"""
Upload processing pipeline.

Structured uploads (employees, compensation, customers, etc.):
  File bytes → validate schema → insert rows → (compensation) auto-fill market_benchmark

Unstructured uploads (survey_responses, csm_notes):
  File bytes → create DB rows → kick off AI signal extraction + re-scoring as background task
"""

import io
import uuid
from datetime import datetime, timezone
from uuid import UUID
from typing import Literal

import pandas as pd
from fastapi import BackgroundTasks

from app.db.client import get_supabase, fetch_one
from app.core.config import settings

TemplateType = Literal[
    "employees", "compensation", "compensation_bands",
    "customers", "churn_signals",
    "survey_responses", "csm_notes", "kpis",
]

UNSTRUCTURED_TYPES = {"survey_responses", "csm_notes"}

REQUIRED_COLUMNS: dict[str, list[str]] = {
    "employees":           ["name", "email", "department", "role", "level", "location", "hire_date"],
    "compensation":        ["employee_email", "salary", "bonus", "equity", "last_review_date"],
    "compensation_bands":  ["role", "level", "location", "market_min", "market_mid", "market_max"],
    "customers":           ["name", "segment", "arr", "renewal_date"],
    "churn_signals":       ["customer_name", "signal_type", "value", "recorded_at"],
    "survey_responses":    ["employee_email", "response_text"],
    "csm_notes":           ["customer_name", "note_type", "meeting_date", "notes"],
    "kpis":                ["name", "category", "value", "target", "unit", "period"],
}


async def process_upload(
    *,
    content: bytes,
    filename: str,
    template_type: TemplateType,
    org_id: UUID,
    user_id: UUID,
    round_id: UUID | None,
    background_tasks: BackgroundTasks,
) -> dict:
    sb = get_supabase()

    # Determine file extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"
    file_type = "xlsx" if ext in ("xlsx", "xls") else ("txt" if ext == "txt" else "csv")

    # Upload raw file to Supabase Storage
    storage_path = f"{org_id}/{template_type}/{uuid.uuid4()}.{ext}"
    sb.storage.from_("org-uploads").upload(storage_path, content)

    # Create uploaded_files row
    row = sb.table("uploaded_files").insert({
        "org_id": str(org_id),
        "user_id": str(user_id),
        "original_filename": filename,
        "storage_path": storage_path,
        "file_type": file_type,
        "template_type": template_type,
        "round_id": str(round_id) if round_id else None,
        "status": "validating",
    }).execute().data[0]

    file_id = row["id"]

    # Kick off processing in background
    if template_type in UNSTRUCTURED_TYPES:
        background_tasks.add_task(
            _process_unstructured,
            content=content,
            file_type=file_type,
            template_type=template_type,
            file_id=file_id,
            org_id=org_id,
            round_id=round_id,
        )
    else:
        background_tasks.add_task(
            _process_structured,
            content=content,
            file_type=file_type,
            template_type=template_type,
            file_id=file_id,
            org_id=org_id,
        )

    return row


def _read_dataframe(content: bytes, file_type: str) -> pd.DataFrame:
    if file_type == "xlsx":
        return pd.read_excel(io.BytesIO(content))
    return pd.read_csv(io.BytesIO(content))


async def _process_structured(
    content: bytes,
    file_type: str,
    template_type: str,
    file_id: str,
    org_id: UUID,
):
    sb = get_supabase()
    try:
        sb.table("uploaded_files").update({"status": "processing"}).eq("id", file_id).execute()

        df = _read_dataframe(content, file_type)
        required = REQUIRED_COLUMNS.get(template_type, [])
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        rows_inserted = _insert_structured_rows(df, template_type, org_id, file_id, sb)

        sb.table("uploaded_files").update({
            "status": "complete",
            "row_count": rows_inserted,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", file_id).execute()

    except Exception as exc:
        sb.table("uploaded_files").update({
            "status": "error",
            "error_message": str(exc),
        }).eq("id", file_id).execute()
        raise


def _insert_structured_rows(df: pd.DataFrame, template_type: str, org_id: UUID, file_id: str, sb) -> int:
    """Insert validated rows into the appropriate table. Returns count inserted."""
    records = df.where(pd.notna(df), None).to_dict(orient="records")

    if template_type == "employees":
        rows = [{"org_id": str(org_id), **_map_employee(r)} for r in records]
        sb.table("employees").upsert(rows, on_conflict="org_id,email").execute()

    elif template_type == "compensation":
        for record in records:
            emp = fetch_one(
                sb.table("employees").select("id, role, level, location")
                .eq("org_id", str(org_id))
                .eq("email", record["employee_email"])
            )
            if not emp:
                continue
            emp_id = emp["id"]
            band = fetch_one(
                sb.table("compensation_bands").select("market_mid")
                .eq("org_id", str(org_id))
                .eq("role", emp.get("role", ""))
                .eq("level", emp.get("level", ""))
                .eq("location", emp.get("location", ""))
            )
            market_mid = band["market_mid"] if band else None
            salary = record.get("salary")
            compa_ratio = round(float(salary) / float(market_mid), 4) if salary and market_mid else None
            sb.table("compensation").upsert({
                "org_id": str(org_id),
                "employee_id": emp_id,
                "salary": salary,
                "bonus": record.get("bonus"),
                "equity": record.get("equity"),
                "market_benchmark": market_mid,
                "compa_ratio": compa_ratio,
                "last_review_date": record.get("last_review_date"),
                "currency": record.get("currency", "USD"),
                "effective_date": record.get("effective_date"),
            }, on_conflict="employee_id").execute()

    elif template_type == "compensation_bands":
        rows = [{"org_id": str(org_id), **r} for r in records]
        sb.table("compensation_bands").upsert(rows, on_conflict="org_id,role,level,location").execute()

    elif template_type == "customers":
        rows = [{"org_id": str(org_id), **_map_customer(r)} for r in records]
        sb.table("customers").upsert(rows, on_conflict="org_id,name").execute()

    elif template_type == "churn_signals":
        for record in records:
            cust = fetch_one(
                sb.table("customers").select("id")
                .eq("org_id", str(org_id))
                .eq("name", record["customer_name"])
            )
            if not cust:
                continue
            sb.table("churn_signals").insert({
                "org_id": str(org_id),
                "customer_id": cust["id"],
                "signal_type": record["signal_type"],
                "value": record["value"],
                "recorded_at": str(record["recorded_at"]),
            }).execute()

    elif template_type == "kpis":
        rows = [{"org_id": str(org_id), **r} for r in records]
        sb.table("kpis").insert(rows).execute()

    return len(records)


async def _process_unstructured(
    content: bytes,
    file_type: str,
    template_type: str,
    file_id: str,
    org_id: UUID,
    round_id: UUID | None,
):
    """Parse unstructured file, create DB rows, then trigger AI analysis pipeline."""
    sb = get_supabase()
    try:
        sb.table("uploaded_files").update({"status": "processing"}).eq("id", file_id).execute()

        df = _read_dataframe(content, file_type) if file_type in ("csv", "xlsx") else None

        if template_type == "survey_responses":
            await _ingest_survey_responses(df, content, file_id, org_id, round_id, sb)
        elif template_type == "csm_notes":
            await _ingest_csm_notes(df, content, file_id, org_id, sb)

        sb.table("uploaded_files").update({
            "status": "complete",
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", file_id).execute()

    except Exception as exc:
        sb.table("uploaded_files").update({"status": "error", "error_message": str(exc)}).eq("id", file_id).execute()
        raise


async def _ingest_survey_responses(df, content, file_id, org_id, round_id, sb):
    from app.services.ai.scoring import trigger_people_rescoring
    from app.services.ai.signal_extractor import extract_survey_signals

    if df is None:
        raise ValueError("survey_responses requires CSV or XLSX")

    affected_employee_ids = []
    for _, row in df.iterrows():
        emp = fetch_one(
            sb.table("employees").select("id")
            .eq("org_id", str(org_id))
            .eq("email", row.get("employee_email"))
        )
        if not emp:
            continue
        emp_id = emp["id"]
        raw_text = str(row.get("response_text", ""))

        signals = await extract_survey_signals(raw_text)

        sr = sb.table("survey_responses").insert({
            "org_id": str(org_id),
            "employee_id": emp_id,
            "round_id": str(round_id) if round_id else None,
            "file_id": file_id,
            "raw_text": raw_text,
            "ai_extracted_signals": signals,
        }).execute().data[0]

        # Chunk and embed for RAG
        from app.services.ai.embedder import embed_and_store
        await embed_and_store(
            text=raw_text,
            source_type="survey_response",
            source_id=sr["id"],
            entity_type="employee",
            entity_id=emp_id,
            org_id=org_id,
            metadata={"round_id": str(round_id) if round_id else None},
        )

        affected_employee_ids.append(emp_id)

    if affected_employee_ids:
        await trigger_people_rescoring(
            org_id=org_id,
            employee_ids=affected_employee_ids,
            trigger_type="upload",
            trigger_source_id=file_id,
        )


async def _ingest_csm_notes(df, content, file_id, org_id, sb):
    from app.services.ai.scoring import trigger_retention_rescoring
    from app.services.ai.signal_extractor import extract_csm_signals

    if df is None:
        raise ValueError("csm_notes requires CSV or XLSX")

    affected_customer_ids = []
    for _, row in df.iterrows():
        cust = fetch_one(
            sb.table("customers").select("id")
            .eq("org_id", str(org_id))
            .eq("name", row.get("customer_name"))
        )
        if not cust:
            continue
        cust_id = cust["id"]
        raw_text = str(row.get("notes", ""))

        signals = await extract_csm_signals(raw_text)

        note = sb.table("csm_notes").insert({
            "org_id": str(org_id),
            "customer_id": cust_id,
            "file_id": file_id,
            "note_type": str(row.get("note_type", "call")),
            "meeting_date": str(row.get("meeting_date")) if row.get("meeting_date") else None,
            "raw_text": raw_text,
            "ai_extracted_signals": signals,
        }).execute().data[0]

        from app.services.ai.embedder import embed_and_store
        await embed_and_store(
            text=raw_text,
            source_type="csm_note",
            source_id=note["id"],
            entity_type="customer",
            entity_id=cust_id,
            org_id=org_id,
            metadata={"note_type": str(row.get("note_type", "call"))},
        )

        affected_customer_ids.append(cust_id)

    if affected_customer_ids:
        await trigger_retention_rescoring(
            org_id=org_id,
            customer_ids=affected_customer_ids,
            trigger_type="upload",
            trigger_source_id=file_id,
        )


def _map_employee(r: dict) -> dict:
    return {
        "name": r.get("name"),
        "email": r.get("email"),
        "department": r.get("department"),
        "role": r.get("role"),
        "level": r.get("level"),
        "location": r.get("location"),
        "hire_date": str(r["hire_date"]) if r.get("hire_date") else None,
        "skills": r.get("skills", "").split(",") if r.get("skills") else [],
        "status": r.get("status", "active"),
    }


def _map_customer(r: dict) -> dict:
    return {
        "name": r.get("name"),
        "segment": r.get("segment"),
        "tier": r.get("tier"),
        "arr": r.get("arr"),
        "renewal_date": str(r["renewal_date"]) if r.get("renewal_date") else None,
        "contract_start": str(r["contract_start"]) if r.get("contract_start") else None,
        "status": r.get("status", "active"),
    }
