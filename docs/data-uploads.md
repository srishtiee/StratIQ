# Data Uploads

Single entry point handles all 8 template types. Diverges into two flows based on whether the template is structured or unstructured (AI-analyzed).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/uploads/` | Multipart upload (file, template_type, org_id, user_id) — returns 202 + `uploaded_files` row |
| `GET`  | `/api/v1/uploads/` | List recent uploads for an org |
| `GET`  | `/api/v1/uploads/{id}` | Poll status of a specific upload |

## Frontend flow

1. User picks template type from dropdown (grouped: Structured / AI-Analyzed)
2. User drops or browses to a CSV/XLSX file
3. Confirm step → `useUploadFile` mutation POSTs FormData
4. `useUploadStatus(id)` polls every 2s
5. Auto-advances UI when status hits `complete` or `error`

## Status lifecycle (`uploaded_files.status`)

```
validating → processing → complete
                       ↘ error
```

| Status | Meaning |
|---|---|
| `pending` | Initial (rare — usually skipped) |
| `validating` | Row created, file in storage, background task starting |
| `processing` | Reading CSV, inserting rows |
| `complete` | Done. `row_count` set, `processed_at` set |
| `error` | Failed. `error_message` set |

## Backend flow — shared entry

`POST /uploads/` → `process_upload()` does:

1. Save raw bytes to Supabase Storage at `{org_id}/{template_type}/{uuid}.{ext}`
2. Insert `uploaded_files` row with `status='validating'`
3. Return that row to client (HTTP 202)
4. Schedule a background task — **flow forks here**

## Structured flow

For: `employees`, `compensation`, `compensation_bands`, `customers`, `churn_signals`, `kpis`

```
status = 'processing'
→ pandas read CSV/XLSX
→ check REQUIRED_COLUMNS  (fail = error)
→ map → upsert/insert into typed table
→ status = 'complete', row_count = N
```

Special cases:
- `compensation` joins to `employees` (via email) and `compensation_bands` (via role/level/location) to auto-fill `market_benchmark` and `compa_ratio`.
- `churn_signals` joins to `customers` (via name).

## Unstructured flow

For: `survey_responses`, `csm_notes`

```
status = 'processing'
→ pandas read CSV/XLSX
→ for each row:
    1. lookup entity (employee/customer)
    2. AI signal extraction (Claude)
    3. insert into survey_responses / csm_notes
    4. embed_and_store  (OpenAI → pgvector)
→ trigger_*_rescoring(affected_ids)
    → Claude rescore each affected entity
→ status = 'complete'
```

The unstructured flow is what makes scores live — uploading a new round of surveys or CSM notes triggers immediate rescoring of every affected entity.

## File format support

- `.csv`, `.xlsx`, `.xls`
- Content types: `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`

## Storage layout

Raw uploaded files live in the `org-uploads` bucket, partitioned by org and template type:

```
org-uploads/
  {org_id}/
    employees/{uuid}.csv
    csm_notes/{uuid}.xlsx
    ...
```

This lets us re-process or audit any file by `uploaded_files.storage_path`.
