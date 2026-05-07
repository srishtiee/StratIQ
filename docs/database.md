# Database

22 tables, grouped by purpose. Source: `backend/supabase/schema.sql`.

Postgres extensions used: `pgcrypto` (UUIDs), `vector` (pgvector for RAG).

## Identity & multi-tenancy

| Table | Purpose |
|---|---|
| `orgs` | Tenant root. Every other table FK's `org_id`. |
| `user_profiles` | App users (separate from Supabase auth.users) |

## People module

| Table | Purpose |
|---|---|
| `employees` | Core roster + `latest_*` score columns (denormalized for UI speed) |
| `compensation` | One row per employee — salary, bonus, equity, market_benchmark, compa_ratio |
| `compensation_bands` | Market salary ranges by `(role, level, location)` |
| `survey_rounds` | Optional groupings of survey waves |
| `survey_responses` | One row per response — raw_text + `ai_extracted_signals` (JSONB) |
| `employee_scores` | Time-series of every attrition risk score ever produced |

## Retention module

| Table | Purpose |
|---|---|
| `customers` | Account list + `latest_*` score columns |
| `churn_signals` | Time-series of structured signals (usage, nps, support, login, csat) |
| `csm_notes` | One row per call/note — raw_text + `ai_extracted_signals` (JSONB) |
| `customer_scores` | Time-series of every churn score ever produced |

## AI / RAG

| Table | Purpose |
|---|---|
| `document_chunks` | Chunked text + embeddings (pgvector) for similarity search |
| `chat_sessions` | One row per chat thread — title, module, timestamps |
| `queries` | User-asked AI questions (FK `session_id` → `chat_sessions`) |
| `ai_analysis_runs` | One row per rescoring batch — module, trigger, status, timing |
| `ai_entity_reasoning` | Plain-English rationale per entity per run |

## Actions

| Table | Purpose |
|---|---|
| `actions` | All AI-suggested actions: type, status (draft → executing → completed), source module/entity, payload |
| `generated_files` | PDFs / CSVs / ICS files produced by action execution |
| `execution_logs` | Step-by-step log per executed action |

## Dashboard / cross-cutting

| Table | Purpose |
|---|---|
| `notifications` | Alerts shown in the alert feed |
| `kpis` | Time-series KPI rows (one per metric per period) |
| `morning_briefs` | Cached daily executive brief, keyed `(org_id, user_id, date)` |
| `uploaded_files` | Metadata for every uploaded file — status, row_count, error_message |

## Key relationships

```
orgs ─┬─ employees ─┬─ compensation
      │             ├─ survey_responses ─ ai_extracted_signals (JSONB)
      │             └─ employee_scores
      │
      ├─ customers ─┬─ churn_signals
      │             ├─ csm_notes ─ ai_extracted_signals (JSONB)
      │             └─ customer_scores
      │
      ├─ uploaded_files ─ (origin of survey_responses / csm_notes / kpis rows)
      │
      ├─ document_chunks  → pgvector → similarity_search
      │
      └─ actions ─┬─ generated_files
                  └─ execution_logs
```

## Score columns: why duplicate?

`employees.latest_attrition_risk_score`, `customers.latest_churn_score` etc. are **denormalized** from the `*_scores` time-series tables. The `*_scores` tables are append-only history; `latest_*` is what the UI reads. The rescoring pipeline updates both atomically.

This keeps list views fast (no aggregation needed) while preserving full audit history.

## RAG via pgvector

`document_chunks` stores chunked text from `survey_responses` and `csm_notes`. Embeddings are added at upload time. At rescoring time, `similarity_search` filters to one entity to produce focused RAG context for the Claude prompt.
