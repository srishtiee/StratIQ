# Upload Templates

8 templates across 2 categories. Required columns are validated; optional columns are accepted if present.

## Quick reference

| Template | Category | Module | Required cols | Optional cols | Conflict key |
|---|---|---|---|---|---|
| `employees` | structured | People | name, email, department, role, level, location, hire_date | skills, status | `(org_id, email)` |
| `compensation` | structured | People | employee_email, salary, bonus, equity, last_review_date | currency, effective_date | `employee_id` |
| `compensation_bands` | structured | People | role, level, location, market_min, market_mid, market_max | — | `(org_id, role, level, location)` |
| `customers` | structured | Retention | name, segment, arr, renewal_date | tier, contract_start, status | `(org_id, name)` |
| `churn_signals` | structured | Retention | customer_name, signal_type, value, recorded_at | — | insert (no upsert) |
| `kpis` | structured | Dashboard | name, category, value, target, unit, period | — | insert (no upsert) |
| `survey_responses` | **AI** | People | employee_email, response_text | — | insert |
| `csm_notes` | **AI** | Retention | customer_name, note_type, meeting_date, notes | — | insert |

## Use cases

### People

**`employees`** — Workspace setup, quarterly headcount sync, restructure. Drives every employee card and attrition risk score.

**`compensation`** — After comp review cycles. Auto-joins with `compensation_bands` to compute `compa_ratio`. Powers "underpaid high performers" insights.

**`compensation_bands`** — Market benchmark data (Radford, Mercer, Pave). **Must load before compensation** for compa-ratio to populate. Annual refresh.

**`survey_responses`** 🟢 AI — Quarterly engagement / pulse surveys. AI extracts burnout, comp frustration, manager issues, etc., embeds for RAG, **automatically re-scores affected employees**.

### Retention

**`customers`** — Sync book of business from Salesforce/HubSpot. New customers, renewals, churns.

**`churn_signals`** — Product usage, NPS, support volume, login frequency, CSAT. Each row is one observation. Weekly/monthly automated export.

**`csm_notes`** 🟢 AI — Call/meeting notes from Gainsight, Catalyst, Notion. AI extracts competitor mentions, sponsor changes, budget pressure, etc., embeds for RAG, **automatically re-scores affected customers**.

### Dashboard

**`kpis`** — Time-series metrics for executive charts. Each row is one metric for one period. Monthly close.

## Recommended loading order (fresh org)

```
1. compensation_bands     ← bands first so compa-ratio works
2. employees              ← unlocks compensation
3. compensation
4. customers              ← unlocks churn_signals
5. churn_signals
6. kpis                   ← independent
7. survey_responses       ← AI; needs employees
8. csm_notes              ← AI; needs customers
```

AI-powered templates lookup entities by email/name and **silently skip rows that don't match**. Always upload entities before their related signals/notes.

## Sample data

Test fixtures live at `backend/test_data/uploads/` with two batches per structured template (`*_batch1.csv`, `*_batch2.csv`).

## Format gotchas

- Dates: ISO `YYYY-MM-DD` (pandas reads them as strings, DB casts to DATE)
- `skills` (employees): comma-separated string in the CSV → split into array on insert
- `signal_type` (churn_signals): **only** `usage`, `nps`, `support`, `login`, `csat` (CHECK constraint)
- `category` (kpis): **only** `hr`, `customer`, `finance`, `ops` (CHECK constraint)
- See [schema-constraints.md](schema-constraints.md) for the full enum reference
