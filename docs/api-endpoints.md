# API Endpoints

All routes are prefixed with `/api/v1`. Source: `backend/app/api/v1/endpoints/`.

Every endpoint requires `org_id` (and many require `user_id`) as query/form params — there's no JWT-derived org context yet.

## People — `/people/*`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/people/employees` | List employees (optional `?department=`) |
| `GET` | `/people/employees/{id}` | Single employee + nested compensation, recent survey signals, score history |
| `GET` | `/people/summary` | Counts + avg engagement (KPI cards) |

## Retention — `/retention/*`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/retention/customers` | List customers (optional `?segment=`) — joins `user_profiles` for CSM name |
| `GET` | `/retention/customers/{id}` | Single customer + recent CSM signals, churn signals, score history |
| `GET` | `/retention/summary` | Counts + total ARR + ARR at risk |

## Dashboard — `/dashboard/*`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/dashboard/morning-brief` | Cached daily brief — generates if not cached for today (`org_id`, `user_id`) |
| `GET` | `/dashboard/kpis` | Latest KPI snapshot (one row per metric) |
| `GET` | `/dashboard/kpis/history` | Full time-series for trend charts (optional `?name=`) |
| `GET` | `/dashboard/alerts` | Recent notifications |

## Actions — `/actions/*`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/actions/` | Create a new action. Payload validated per type. Tier defaults to `low` for `task`/`pdf_report`, `mid` for `email_send`. Mid/high → `pending_approval`; low → `draft`. |
| `GET` | `/actions/` | List actions (optional `?status=`) |
| `POST` | `/actions/{id}/execute` | Execute. Low-tier runs from `draft` or `approved`; mid/high require `approved`. |
| `PATCH` | `/actions/{id}/approve` | Mark as approved (sets `approved_by`) |
| `PATCH` | `/actions/{id}/reject` | Mark as rejected (sets `rejected_reason`) |

Supported types: `task`, `email_send`, `pdf_report`. Each has a Pydantic payload schema in `app/schemas/actions.py` validated at create + execute time.

## Uploads — `/uploads/*`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/uploads/` | Multipart upload — kicks off background processing, returns 202 |
| `GET` | `/uploads/` | List recent uploads for org |
| `GET` | `/uploads/{id}` | Poll status of one upload |

## Queries (AI) — `/queries/*`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/queries/` | Submit an AI question (streaming SSE). Body: `{org_id, user_id, module, question, session_id?}`. Creates a session if none provided. |
| `GET` | `/queries/history` | Flat list of recent queries (kept for back-compat) |
| `GET` | `/queries/sessions` | List chat sessions for `(org_id, user_id)`, optional `?module=` filter |
| `GET` | `/queries/sessions/{id}` | Session metadata + full turn history (oldest first) |
| `DELETE` | `/queries/sessions/{id}` | Delete session and (cascade) its queries |

### SSE event types from `POST /queries/`

| Event | Payload |
|---|---|
| `session` | `{ session_id }` — emitted once, useful when a new session was created |
| `status` | `{ step, message }` — pipeline progress |
| `token` | `{ text }` — incremental tokens from the response generator |
| `refined` | `{ text }` — full refined response (replaces streamed tokens if critic flagged issues) |
| `done` | `{ query_id, session_id, response, sources, suggested_actions, latency_ms }` |

## Conventions

- Trailing slash on collection routes (`/actions/`, `/uploads/`) — FastAPI pattern.
- `org_id` is a query param everywhere (and a form field for uploads).
- `executed_at` (not `updated_at`) on `actions`. Frontend types must match.
- List endpoints return raw arrays or `{data, count}` shapes — see `frontend/lib/api/types.ts` for exact response shapes.
