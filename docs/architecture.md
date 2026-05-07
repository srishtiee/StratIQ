# Architecture

## Three modules

StratIQ is structured around three product surfaces, each backed by its own API namespace and frontend section.

| Module | Frontend | Backend | Purpose |
|---|---|---|---|
| **People Intelligence** | `/people` | `/api/v1/people/*` | Attrition risk, engagement, comp/compa-ratio analysis |
| **Customer Retention** | `/retention` | `/api/v1/retention/*` | Churn risk, customer health, ARR-at-risk |
| **Executive Dashboard** | `/dashboard` | `/api/v1/dashboard/*` | KPI trends, morning brief, alerts, cross-module overview |

Two cross-cutting modules:

| Module | Purpose |
|---|---|
| **Actions** (`/actions`, `/api/v1/actions/*`) | All AI-suggested actions across modules — draft → approval → execute → log |
| **Uploads** (`/uploads`, `/api/v1/uploads/*`) | Data ingestion (8 templates, structured + unstructured) |

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, Python 3.14, async endpoints |
| DB / Auth / Storage | Supabase (Postgres + PostgREST + pgvector + Storage) |
| AI orchestration | Anthropic Claude (Sonnet for analysis), OpenAI for embeddings |
| Frontend | Next.js 16.2.2 (App Router), React 19, TanStack Query v5, Tailwind |
| State | TanStack Query for server state; no Redux/Zustand |

## Key design choices

- **Two-layer signals.** Quantitative numbers in typed tables (`churn_signals`, `kpis`) + qualitative AI-extracted signals (JSONB on `survey_responses`, `csm_notes`). Both feed the rescoring pipeline.
- **Per-org isolation.** Every row carries `org_id`. Multi-tenant from day one.
- **RAG over embeddings.** Unstructured text chunks → pgvector → similarity search per entity at scoring time.
- **Background tasks via FastAPI `BackgroundTasks`.** Uploads return 202 immediately; processing runs async.
- **No mocking in tests yet.** Integration tests hit real Supabase (see memory: don't mock the DB).

## `MOCK_AI` flag

Backend `.env`: `MOCK_AI=true` short-circuits every Claude / OpenAI call to return deterministic placeholder responses. Used during integration to avoid API spend. **Must be `false` for the demo** — see memory note `project_mock_ai_flag.md`.

## Data flow at a glance

```
Upload (CSV)
  ↓
Storage + uploaded_files row
  ↓
Background task
  ├── structured  → upsert to typed table
  └── unstructured → AI signal extraction → embed → trigger rescoring
                      ↓
                      Claude rescore → write 3 tables → update entity.latest_*
                      ↓
                      UI re-fetches via TanStack Query
```
