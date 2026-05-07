# Schema Constraints

All Postgres `CHECK` constraints / enum values in one place. Source of truth: `backend/supabase/schema.sql`.

If an upload fails with code `23514` (`violates check constraint`), check this file first.

## Identity / access

| Table | Column | Allowed values |
|---|---|---|
| `user_profiles` | `role` | `admin`, `viewer` |

## People module

| Table | Column | Allowed values |
|---|---|---|
| `employees` | `status` | `active`, `terminated`, `on_leave` |
| `employee_scores` | `trigger_type` | `initial`, `upload`, `query`, `scheduled` |

## Retention module

| Table | Column | Allowed values |
|---|---|---|
| `customers` | `status` | `active`, `churned`, `renewed` |
| `churn_signals` | `signal_type` | `usage`, `nps`, `support`, `login`, `csat` |
| `customer_scores` | `trigger_type` | `initial`, `upload`, `query`, `scheduled` |
| `csm_notes` | `note_type` | `call`, `qbr`, `email`, `escalation`, `renewal`, `onboarding` |

## Uploads

| Table | Column | Allowed values |
|---|---|---|
| `uploaded_files` | `file_type` | `csv`, `xlsx`, `txt`, `pdf` |
| `uploaded_files` | `template_type` | `employees`, `compensation`, `compensation_bands`, `customers`, `churn_signals`, `survey_responses`, `csm_notes`, `kpis` |
| `uploaded_files` | `status` | `pending`, `validating`, `processing`, `complete`, `error` |

## AI / RAG

| Table | Column | Allowed values |
|---|---|---|
| `document_chunks` | `entity_type` | `employee`, `customer` |
| `queries` | `module` | `people`, `retention` |
| `ai_analysis_runs` | `module` | `people`, `retention` |
| `ai_analysis_runs` | `trigger_type` | `initial`, `upload`, `query`, `scheduled` |
| `ai_analysis_runs` | `status` | `running`, `complete`, `failed` |
| `ai_entity_reasoning` | `entity_type` | `employee`, `customer` |

## Actions

| Table | Column | Allowed values |
|---|---|---|
| `actions` | `status` | `draft`, `pending_approval`, `approved`, `executing`, `completed`, `rejected`, `failed` |
| `actions` | `source_module` | `people`, `retention`, `dashboard` |
| `actions` | `source_entity_type` | `employee`, `customer` |
| `actions` | `priority` | `high`, `medium`, `low` |
| `actions` | `type` | `task`, `email_send`, `pdf_report` |
| `actions` | `approval_tier` | `low`, `mid`, `high` (default `low`; `email_send` defaults to `mid`) |
| `generated_files` | `file_type` | `pdf`, `csv`, `xlsx`, `ics` |

## Notifications & KPIs

| Table | Column | Allowed values |
|---|---|---|
| `notifications` | `type` | `action_pending_approval`, `action_completed`, `action_failed`, `scores_updated`, `upload_complete` |
| `kpis` | `category` | `hr`, `customer`, `finance`, `ops` |
| `kpis` | `trend` | `up`, `down`, `flat` |

## Common gotchas

- Don't invent descriptive enum values (e.g., `usage_drop`, `revenue`, `people`). Pick from the lists above.
- `notifications` does **not** have a `severity` column — map `type` to severity in the UI instead.
- All `*_id` foreign keys cascade from `org_id` first — RLS-friendly.
