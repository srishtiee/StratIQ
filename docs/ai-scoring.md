# AI Scoring Pipeline

How attrition risk and churn risk scores are produced and refreshed.

Code: `app/services/ai/scoring.py`

## Two parallel pipelines

| Pipeline | Function | Entity | Reads | Writes |
|---|---|---|---|---|
| People | `_rescore_employee` | `employees` | survey signals, comp, RAG chunks | `employee_scores`, `employees.latest_*` |
| Retention | `_rescore_customer` | `customers` | csm signals, churn signals, RAG chunks | `customer_scores`, `customers.latest_*` |

Triggered through:
- `trigger_people_rescoring(employee_ids, ...)`
- `trigger_retention_rescoring(customer_ids, ...)`

Both create an `ai_analysis_runs` row, then iterate over each entity.

## Per-entity steps

```
1. Pull entity row + nested relations
   - employee: compensation(...), survey_responses(ai_extracted_signals, ...)
   - customer: csm_notes(ai_extracted_signals, ...), churn_signals(...)

2. Check for RAG chunks for this entity
   - If chunks exist: similarity_search → top 3 chunks → rag_context

3. Build prompt:
   - profile data (JSON)
   - latest AI signals (JSON)
   - RAG context (text)

4. Call Claude  (settings.analyst_model, max_tokens=512)
   - Or, if MOCK_AI=true: return deterministic stub

5. Parse JSON response
   - Score, reasoning, contributing_factors

6. Insert score row
   - employee_scores  /  customer_scores
     with trigger_type, trigger_source_id, ai_rationale

7. Insert reasoning row
   - ai_entity_reasoning  (run_id, entity_type, entity_id, score_before/after, delta, factors)

8. Update parent row
   - employees.latest_attrition_risk_score, latest_engagement_score, scores_last_updated_at
   - customers.latest_churn_score, latest_health_score, latest_revenue_at_risk
```

## What gets written per rescore

| Table | Purpose |
|---|---|
| `ai_analysis_runs` | One per batch — module, trigger_type, status, started_at, completed_at |
| `employee_scores` / `customer_scores` | Time-series of every score ever produced (kept for trend/audit) |
| `ai_entity_reasoning` | Plain-English rationale + contributing factors per entity per run |
| `employees` / `customers` | `latest_*` columns updated for fast UI reads |

## Trigger types

| `trigger_type` | When |
|---|---|
| `initial` | First score on entity creation |
| `upload` | After unstructured upload (survey_responses or csm_notes) |
| `query` | Manual re-run from query UI |
| `scheduled` | (Future) periodic refresh |

`trigger_source_id` points to the originating row (e.g., `uploaded_files.id` for upload triggers).

## RAG context

Built only if `document_chunks` has rows for the entity. Skips the embedding API call entirely otherwise — no point doing similarity search if nothing is indexed.

```
similarity_search(
  query_text="employee risk signals for {name}" | "churn risk signals for {name}",
  org_id, entity_type, entity_ids=[id]
) → top chunks (filtered to this entity)
```

## MOCK_AI behavior

When `settings.mock_ai = True`, both rescore functions return:
- A small score increment from the previous score
- A canned reasoning string explaining mock mode
- Static `contributing_factors`

Lets the rest of the pipeline (DB writes, UI updates) run without API spend.
