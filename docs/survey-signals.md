# Survey Signals (People)

Parallel to churn signals on the Retention side: AI-extracted signals from employee survey free-text feed attrition risk + engagement scoring.

## AI-extracted signals — `survey_responses.ai_extracted_signals` (JSONB)

Produced by Claude when a `survey_responses` upload runs (`extract_survey_signals` in `signal_extractor.py`):

| Key | Type | Meaning |
|---|---|---|
| `job_search_intent` | `boolean` | Direct or indirect mention of considering leaving |
| `manager_frustration` | `boolean` | Frustration with management surfaced |
| `burnout_signals` | `string[]` | Direct quotes / phrases indicating burnout |
| `compensation_frustration` | `boolean` | Pay-related dissatisfaction |
| `career_stagnation` | `boolean` | Concerns about growth, promotion, learning |
| `sentiment_label` | `'positive' \| 'neutral' \| 'negative'` | Overall sentiment |
| `sentiment_score` | `0.0 – 1.0` | Numeric sentiment confidence |
| `key_quotes` | `string[]` | Up to 3 most significant quotes |

## Aggregate scores (per employee)

Stored on the `employees` row; written by the rescoring pipeline:

| Field | Range | Meaning |
|---|---|---|
| `latest_attrition_risk_score` | 0–100 | Higher = more likely to leave |
| `latest_engagement_score` | 0–100 | Higher = more engaged |
| `latest_performance_score` | 0–100 | Higher = stronger performer |
| `scores_last_updated_at` | timestamp | When rescoring last ran |

## How they combine

Inputs to Claude (`_rescore_employee` in `scoring.py`):

```
employee profile (department, role, level, tenure, current scores)
compensation row (salary, market_benchmark, compa_ratio)
latest survey_responses.ai_extracted_signals
RAG context from survey_responses embeddings

→ attrition_risk_score, engagement_score
+ reasoning (plain English)
+ contributing_factors: comp_gap, engagement_signals, survey_signal, tenure_risk
```

The compa-ratio (from `compensation` joined with `compensation_bands`) is a key quantitative input — under-market employees with negative survey signals get flagged hardest.

## When scores update

Same trigger model as churn signals — see [churn-signals.md](churn-signals.md#when-scores-update). Uploading new survey responses triggers rescoring of every affected employee.

## Survey rounds

Optional `round_id` on `survey_responses` lets you group responses by survey wave (`survey_rounds` table). When uploading, pass `round_id` in the form data to associate the file with a specific wave.
