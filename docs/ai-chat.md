# AI Chat (Ask StratIQ)

The unified chat experience: a global floating button that opens a drawer with multi-turn conversations scoped to a module, with persistent session history.

## Where it lives

| Surface | File |
|---|---|
| Floating button + drawer | `frontend/components/shared/ask-ai-fab.tsx` |
| Single chat panel UI | `frontend/components/shared/query-panel.tsx` |
| Streaming hook (state + send) | `frontend/lib/api/use-query-stream.ts` |
| SSE parser | `frontend/lib/api/query-stream.ts` |
| Session list / load / delete hooks | `frontend/lib/api/hooks.ts` (`useChatSessions`, `useChatSession`, `useDeleteChatSession`) |
| Mounted globally | `frontend/app/(main)/layout.tsx` |
| Backend routes | `backend/app/api/v1/endpoints/queries.py` |
| Streaming pipeline | `backend/app/services/ai/pipeline.py` |

## Data model

| Table | Purpose |
|---|---|
| `chat_sessions` | One row per conversation thread — `(org_id, user_id, module, title, created_at, updated_at)` |
| `queries` | One row per turn (question + response). FK `session_id` → `chat_sessions(id)` with `ON DELETE CASCADE` |

`module` on `chat_sessions` is pinned to `'people'` or `'retention'` (matches the same CHECK constraint on `queries.module`). A session cannot span modules — the RAG scope is module-bound.

## Pipeline

The chat panel uses the standard query pipeline — Intent Router → SQL Analyst → Data Executor → RAG Retriever → Context Injector → Response Generator → Critic → Refiner → Action Planner. Plus an action-intent fork right after the Intent Router that routes commands like "Email Marcus…" to the action creator.

Full step-by-step reference: [ai-pipeline.md](ai-pipeline.md).

## Backend endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/queries/` | Submit a question. Body accepts optional `session_id`. Streams SSE. |
| `GET` | `/queries/sessions` | List sessions (most recent first). Optional `?module=` filter. |
| `GET` | `/queries/sessions/{id}` | Returns `{session, turns}` — session metadata + full history (oldest first). |
| `DELETE` | `/queries/sessions/{id}` | Cascades to delete the session's queries. |
| `GET` | `/queries/history` | Flat list (legacy, kept for back-compat). |

### SSE event shapes

| Event | Payload | When |
|---|---|---|
| `session` | `{ session_id }` | Once per request, right after session resolution |
| `status` | `{ step, message }` | Pipeline progress (`intent`, `data`, `rag`, `generating`, `reviewing`, `refining`) |
| `token` | `{ text }` | Each Claude streaming chunk during response generation |
| `refined` | `{ text }` | If the critic flagged issues, full refined replacement text |
| `done` | `{ query_id, session_id, response, sources, suggested_actions, latency_ms }` | Final |

## Multi-turn context

The pipeline (`run_query_pipeline`) does:

```
1. Resolve session
   - If session_id passed → use it
   - Else → INSERT chat_sessions row, title = truncate(question, 60)

2. Pull last 6 prior turns from queries WHERE session_id = ...
   _format_history → "Conversation history (oldest first):\nUser: ...\nAssistant: ..."

3. Insert this turn's queries row (session_id set)
4. Bump chat_sessions.updated_at

5. Yield 'session' event so client picks up new session_id

6. Run pipeline:
   - Intent classifier sees history     ← resolves "what about Sales?"
   - SQL analyst gets resolved sql_hint  ← no history needed
   - Response generator sees history     ← stays on-thread

7. Save response to queries row
8. Yield 'done' with session_id
```

Token cost is bounded: each prior assistant turn is trimmed to 500 chars, only last 6 turns included.

## Frontend layering

```
AskAIFab          ← floating button + Sheet container
  ├── ModuleSwitcher        ← pill: People / Retention
  ├── SessionSidebar        ← list, grouped by module
  │     ├── New chat button
  │     ├── SessionGroup (current module)
  │     └── SessionGroup (other module)
  └── QueryPanel            ← messages + input
        └── useQueryStream(module)   ← owns ChatMessage[] + sessionId
                ├── streamQuery(...)  ← async generator over SSE
                └── loadSession(...)  ← hydrate from /sessions/{id}
```

`AskAIFab` owns the chat hook. `SessionSidebar` only receives `loadSession` (stable callback) — never the whole `chat` object — to avoid effect re-runs on every render.

## Module routing logic

| Where the user is | Drawer module on open |
|---|---|
| `/retention*` | `retention` |
| Anywhere else (incl. `/people*`, `/dashboard`, `/uploads`, etc.) | `people` (default) |

Override: clickable pill in the header switches modules. Switching mid-conversation calls `chat.newChat()` (resets messages + session_id) — sessions are pinned to a module on the server.

Clicking a session from the *other* module from the sidebar list auto-switches the drawer's module before loading.

## Session lifecycle

| Action | What happens |
|---|---|
| User types first question | Server creates `chat_sessions` row, server emits `session` event, client captures id |
| User asks follow-up | Client passes `session_id`, server pulls last 6 turns, threads into prompts |
| User clicks "New chat" | Client clears `messages` + `sessionId`, next question creates a fresh session |
| User clicks past session | Client fetches `/sessions/{id}`, calls `chat.loadSession(...)`, replaces `messages` |
| User deletes session | `DELETE /sessions/{id}` → cascades to queries; sessions list invalidates |
| Session title | Set once at creation from truncated first question (60 chars). Currently no auto-rename. |

## Notes / gotchas

- Sessions list is invalidated on every new `chat.sessionId` change so brand-new chats appear in the sidebar without manual refresh.
- The drawer mounts the chat hook **once** while open. Closing the drawer unmounts it; on reopen, state resets unless a session is reloaded.
- The Sheet ships with a built-in close `X` at `top-3 right-3`. The header has `pr-10` to keep its content from sliding under it.
- Switching modules creates a new chat hook instance (since `useQueryStream` deps on `module`). That's intentional — keeps RAG scope clean.
- Pipeline still respects `MOCK_AI=true` — sessions are still created, history is still threaded into the (mock) prompts, all UI flows still exercise.

## Future work (not done)

- LLM-generated session titles (cheap Haiku call) instead of truncation
- Cross-module sessions (would require expanding `module` CHECK on `queries` and `chat_sessions` to include `'dashboard'` or `null`)
- Search across sessions
- Pin / star sessions
- Session-level soft-delete with restore (currently hard delete via cascade)
