# AI Query Pipeline

The end-to-end pipeline that turns a user's chat message into a streamed answer (or a drafted action). Backed by Claude (Sonnet for analysis, Haiku for routing/critique) and OpenAI embeddings (RAG).

Code: `backend/app/services/ai/pipeline.py` (entry point: `run_query_pipeline`).
Invoked from: `POST /api/v1/queries/` (streams SSE).

## Step map

```
              POST /queries/
                    │
                    ▼
            session resolve
                    │
                    ▼
       persist queries row + emit 'session'
                    │
                    ▼
          ┌─ Step 1: Intent Router ─┐
          │   (Haiku)                │
          │   threads conversation   │
          │   history                │
          └──┬───────────────────────┘
             │
             ▼
   ─────────────────────────────────
   "Is this an action command?"
   ─────────────────────────────────
       │ yes              │ no
       ▼                  ▼
  Action fork       analytical path
  → action_creator   continues below
       │                  │
       ▼                  ▼
  emit                 Step 2: SQL Analyst (Sonnet)
  'action_draft'             ↓
       │              Step 3: Data Executor
       ▼                     ↓
  emit 'done'         Step 4: RAG Retriever (pgvector)
                             ↓
                      Step 4.5: Context Injector
                             ↓
                      Step 5: Response Generator (Sonnet, stream)
                             ↓ tokens stream as 'token' events
                      Step 6: Critic (Haiku)
                             ↓
                      Step 7: Refiner (Sonnet)  [if critic flagged]
                             ↓ emit 'refined'
                      Step 8: Action Planner (Haiku)
                             ↓ inserts draft actions rows
                      persist + emit 'done'
```

## Steps in detail

| # | Step | Model / cost | Input | Output | Notes |
|---|---|---|---|---|---|
| 0 | Session resolve | DB | `session_id?` | `session_id_str` + last 6 turns | Creates `chat_sessions` row if absent. Bumps `updated_at`. |
| 1 | Intent Router | Haiku, ≤256 tok | question + history + module | `{needs_sql, needs_rag, sql_hint, entity_focus}` | Resolves follow-ups ("what about Sales?") into self-contained sql_hints. |
| 1.5 | **Action-intent fork** | Haiku, ≤128 tok | question + module | `{is_action, action_type, entity_hint}` | If true → routes to `action_creator.create_draft_action`, skips steps 2–8. |
| 2 | SQL Analyst | Sonnet, ≤512 tok | sql_hint + module + org_id | Postgres SELECT statement | Schema-aware prompt; read-only by convention. |
| 3 | Data Executor | DB | SQL string | Up to ~50 rows | Runs via `execute_read_query` Postgres function. Catches errors; falls through to RAG-only if SQL fails. |
| 4 | RAG Retriever | OpenAI embed | question + entity_focus | Top-K `document_chunks` | pgvector cosine similarity, optionally filtered to one entity. Skipped when no chunks exist for the entity. |
| 4.5 | **Context Injector** | DB only, no LLM | org_id, user_id, module | Compact text block with KPIs, alerts, module snapshot, pending approvals | See [Context Injector](#context-injector) below. |
| 5 | Response Generator | Sonnet, ≤1024 tok, **streaming** | question + history + global_context + sql_results + rag_context | Narrative answer, streamed token-by-token | Each token emitted as `token` SSE event. |
| 6 | Critic | Haiku, ≤256 tok | question + draft response | `{severity, issues, suggestion}` | `severity ∈ none / minor / major`. |
| 7 | Refiner | Sonnet, ≤1024 tok | original + critique | Improved response | Only runs if `severity != none`. Emits `refined` SSE event. |
| 8 | Action Planner | Haiku, ≤512 tok | question + final response | Up to 3 action specs | Persists each as a draft `actions` row (with valid payload + tier). Filters to supported types only (task / email_send / pdf_report). |

## Context Injector

`backend/app/services/ai/context_injector.py`

A non-LLM step that gathers org-wide state and injects it as `{global_context}` into the response prompt. Runs ~4 fast DB queries per call.

| Block | Source | Limit |
|---|---|---|
| KPIs | latest row per `kpis.name` | 6 metrics |
| Active alerts | `notifications` where `read=false` | 3 most recent |
| People snapshot | `employees` aggregate | always 1 line |
| Retention snapshot | `customers` aggregate | always 1 line |
| Pending approvals | `actions` where `status='pending_approval'` | count + top 2 titles |

Output is plain text, ~300–600 tokens. Empty string if the org has no data at all.

Without it, the AI answers questions about your org *as if it had no idea what's currently happening*. With it, every answer is grounded ("ARR at risk just crossed $970K", "TechCorp Inc. churn score is 88") rather than generic.

## SSE event flow (what the client sees)

| Event | When | Payload |
|---|---|---|
| `session` | After session resolve | `{session_id}` |
| `status` | At each step boundary | `{step, message}` — values: `intent`, `action_drafting`, `data`, `rag`, `context`, `generating`, `reviewing`, `refining` |
| `action_draft` | After action fork drafts | `{action}` (full ApiAction row) |
| `token` | Each Sonnet streaming chunk | `{text}` |
| `refined` | If critic flagged issues | `{text}` (full replacement narrative) |
| `done` | Final | `{query_id, session_id, response, sources, suggested_actions, latency_ms}` |

## Database side-effects

| Table | Rows written | When |
|---|---|---|
| `chat_sessions` | 1 (if new) | Step 0 |
| `queries` | 1 | Step 0 (insert) + Step 8 (update with intent, sql, sources, response, critique, latency) |
| `actions` | 0–3 | Step 8 (auto drafts) OR Step 1.5 (1 explicit draft via action fork) |
| `document_chunks` | 0 | Read-only for RAG |
| `notifications` | 0 | Read-only for context injector |

## MOCK_AI behavior

When `settings.mock_ai = True`, the pipeline:

- Still creates `chat_sessions` row + `queries` row + threads history
- Still runs the Context Injector (it's not LLM)
- Bypasses all Anthropic / OpenAI calls
- Emits a single canned `token` event + `done` event
- Action fork uses keyword heuristics instead of intent classification
- Auto-drafted actions don't get suggested

Lets the rest of the system (DB writes, UI updates, session list) exercise without API spend.

## Deferred: Analytics Engine

The master plan defined a 5th step — **Analytics Engine** — between Data Executor and RAG. It would run pandas/sklearn over the SQL rows to produce derived facts (percentile rank, MoM trend, cohort comparison, statistical significance) that the Response Generator could cite verbatim.

**Status:** not implemented. SQL rows go straight to the response prompt; Sonnet does its own inline reasoning.

**When to add it:** when real users ask questions where the LLM is producing wrong stats or hand-waving. Not a blocker for the MVP.

## Latency budget (per query, MOCK_AI=false)

Rough back-of-envelope:

| Step | Typical cost |
|---|---|
| Session resolve + DB inserts | <50ms |
| Intent Router (Haiku) | ~400ms |
| Action fork (Haiku, only when triggered) | ~400ms |
| SQL Analyst (Sonnet) | ~1.5s (when needed) |
| Data Executor | <100ms |
| RAG Retriever | ~600ms (embed + vector search) |
| Context Injector | <200ms |
| Response Generator (Sonnet, streaming) | First token ~600ms, full response ~3s |
| Critic (Haiku) | ~400ms |
| Refiner (Sonnet, optional) | ~1.5s |
| Action Planner (Haiku) | ~500ms |
| **Total typical** | ~6–8s end-to-end |

Streaming hides most of it — the user sees the first token at ~3s.
