# Environment Variables

## Backend — `backend/.env`

Loaded by `app/core/config.py` via `pydantic-settings`.

### Required

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only — bypasses RLS) |
| `SUPABASE_ANON_KEY` | Anon key (for client-side flows if needed) |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | Used for embeddings (`text-embedding-3-small`) |

### Optional / defaults

| Var | Default | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `""` | Email sending (action execution) |
| `MOCK_AI` | `false` | Bypass all AI APIs with deterministic stubs |
| `ENVIRONMENT` | `development` | Free-form env tag |
| `LOG_LEVEL` | `INFO` | — |

### Model config (override only if needed)

| Var | Default |
|---|---|
| `INTENT_MODEL` | `claude-haiku-4-5-20251001` |
| `ANALYST_MODEL` | `claude-sonnet-4-6` |
| `CRITIC_MODEL` | `claude-haiku-4-5-20251001` |
| `REFINER_MODEL` | `claude-sonnet-4-6` |
| `EMBEDDING_MODEL` | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | `1536` |

### RAG tuning

| Var | Default |
|---|---|
| `RAG_TOP_K` | `5` |
| `CHUNK_SIZE` | `512` |
| `CHUNK_OVERLAP` | `64` |

## Frontend — `frontend/.env.local`

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes (default `http://localhost:8000/api/v1`) | Backend base URL |
| `NEXT_PUBLIC_ORG_ID` | yes | Org context (passed to every API call) |
| `NEXT_PUBLIC_USER_ID` | yes | User context (for morning brief, action approvals, uploads) |

## Demo gotchas

- **`MOCK_AI=true`** must be set to `false` before the demo. Otherwise scoring is canned and AI panels return stubs. See memory note `project_mock_ai_flag.md`.
- **`NEXT_PUBLIC_*`** vars are inlined at build time. After changing them, **restart `next dev`** — hot reload won't pick them up.
- All Supabase keys must point to the **same project** as the seeded data. Cross-project keys silently return empty rows.
