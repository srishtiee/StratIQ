# Conventions & Gotchas

Things that aren't obvious from reading the code, captured so future-you doesn't re-learn them.

## Backend

### `supabase-py` 2.x — `.maybe_single()` is broken

When `.maybe_single().execute()` finds zero rows, it returns `None` (not a response wrapper), so `.data` access raises `AttributeError`.

**Always use `fetch_one()` from `app/db/client.py` instead:**

```python
from app.db.client import fetch_one
row = fetch_one(sb.table("foo").select("*").eq("id", id))
if not row:
    raise HTTPException(404)
use(row["field"])
```

### PostgREST FK joins

Nested selects only work where there's a real foreign key:

```python
# WORKS — customers.csm_id REFERENCES user_profiles(id)
.select("*, user_profiles!csm_id(name)")

# DOES NOT WORK — ai_entity_reasoning.entity_id is a generic UUID with no FK
.select("*, ai_entity_reasoning(reasoning, ...)")
```

If you need a nested-looking shape from a non-FK relation, do a separate query and merge in Python.

### `BackgroundTasks` for uploads

`process_upload` schedules a `BackgroundTask` and returns 202 immediately. The frontend polls `GET /uploads/{id}` for status. Don't block the request waiting for processing.

### CHECK constraints catch enum drift

Always check `docs/schema-constraints.md` before inventing a new enum value. Postgres returns code `23514` when violated — and that error makes it all the way to the upload's `error_message`.

## Frontend

### This is Next.js 16 — read the migrated docs

`frontend/AGENTS.md` is explicit: "This is NOT the Next.js you know." Read `node_modules/next/dist/docs/` before assuming an API exists. Skip your training data on App Router specifics.

### TanStack Query v5 — `refetchInterval` signature

In v5, `refetchInterval` receives the `query` object, not `data`:

```typescript
refetchInterval: (query) => {
  const data = query.state.data
  return done(data) ? false : 2000
}
```

### `'use client'` is required for hooks

Every file using `useQuery`, `useMutation`, `useState`, `useEffect`, etc. needs `'use client'` at the top. App Router defaults to server components.

### API field names — match backend exactly

| Frontend field | Backend column |
|---|---|
| `original_filename` | NOT `filename` |
| `source_module` | NOT `module` |
| `executed_at` | NOT `updated_at` |
| `rejected_reason` | NOT `error_message` |
| `latest_attrition_risk_score` | flat on `employees` (not nested) |
| `compensation.compa_ratio` | nested via PostgREST join |

If you see `undefined` for a field that should have a value, this is the first thing to check.

### Don't add `severity` to notifications

The DB has no `severity` column. Map `notification.type` to severity/icon/color in the alert-feed component instead.

### File uploads bypass `apiFetch`

`apiFetch` sets `Content-Type: application/json`. For multipart uploads, use raw `fetch` and let the browser set the boundary header.

## Shared

### Always include `org_id`

Every API call requires `org_id`. Frontend reads it from `NEXT_PUBLIC_ORG_ID`. Backend reads it as a query/form param. There's no JWT-derived org context yet — explicit only.

### Templates depend on each other

Upload order matters. See [upload-templates.md](upload-templates.md#recommended-loading-order-fresh-org) for the dependency graph. AI templates silently skip rows that don't match an existing entity, so always upload entities first.

### MOCK_AI is a footgun

`MOCK_AI=true` short-circuits every AI call to return canned responses. Useful during integration. **Catastrophic for the demo if left on.** Always verify the `.env` before recording demos.
