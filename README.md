# StratIQ

StratIQ is a dashboard-first, AI-assisted executive decision-support prototype. The main end-to-end workflow is **Customer Churn and Retention**; employee attrition remains **future-ready**.

## Capability Status

- **Implemented**
  - Bounded adversarial workflow: Analyst -> Researcher -> Planner -> Risk/Compliance -> Arbiter -> Comms
  - Dashboard/workflow/approvals/audit/customer detail pages
  - Postgres persistence (Supabase/Postgres-compatible)
  - Request correlation IDs (`X-Request-ID`) across API responses, workflow runs, and audit rows
  - Prototype RBAC enforced on the API (roles: executive, approver, analyst, admin, viewer)
  - JWT access tokens (`POST /api/auth/login`, `POST /api/auth/register`, optional `POST /api/auth/google`)
  - Admin role management (`GET /api/auth/users`, `PATCH /api/auth/users/{user_id}/role`) with `/admin/users` UI
  - Approval/action state transitions with transition audit records
  - Deterministic reasoning default with optional Grok/OpenAI fallback behavior
  - Sign-in UI at `/login` (email/password; optional Google if configured)
- **Prototype implementation**
  - Audit trail is writable (not immutable/WORM)
  - Auth is app-issued JWT plus a **demo** header fallback for local/API tests—not production SSO
  - Evidence retrieval is deterministic keyword + structured lookup; vector path is only schema-ready
- **Optional / configurable**
  - `STRATIQ_LLM_MODE=grok|openai|deterministic` (default deterministic)
  - `STRATIQ_AUTH_MODE=demo|jwt` — `demo` allows header-based actor for curl/pytest; `jwt` requires `Authorization: Bearer` on protected routes
  - Google sign-in when `STRATIQ_GOOGLE_CLIENT_ID` (API) and `NEXT_PUBLIC_STRATIQ_GOOGLE_CLIENT_ID` (web) are set
- **Future-ready**
  - Pgvector-powered semantic retrieval
  - Production-grade SSO/OIDC and hardened policy engine

## Local Run

```bash
npm install
python3 -m venv .venv && source .venv/bin/activate
pip install -r api/requirements.txt
cp .env.example .env.local
cp web/.env.local.example web/.env.local
npm run dev:api
npm run dev:web
```

Environment file convention:
- Backend/API runtime config: root `.env.local`
- Frontend runtime config: `web/.env.local`
- Templates only: `.env.example`, `api/.env.example`, `web/.env.local.example`

Or start DB+API with Docker:

```bash
docker compose up -d postgres api
```

## Seed Database

- Docker Postgres auto-seeds from `db/schema.sql` and `db/seed.sql`.
- Migration-ready SQL lives in `api/db/migrations/001_initial_schema.sql`.
- Demo chunk seed for retrieval lives in `api/db/seeds/001_demo_seed.sql`.

## Tests

```bash
PYTHONPATH=. pytest api/tests -q
npm run lint
npm run build:web
```

## Key Environment Variables

- `DATABASE_URL=postgresql+psycopg://stratiq:stratiq@localhost:5432/stratiq`
- `STRATIQ_AUTH_MODE=demo|jwt` (default `demo` for local/tests; use `jwt` to require bearer tokens)
- `STRATIQ_JWT_SECRET` (set a long random secret in any shared/deployed environment)
- `STRATIQ_GOOGLE_CLIENT_ID` (optional; server-side verification of Google ID tokens)
- `NEXT_PUBLIC_STRATIQ_GOOGLE_CLIENT_ID` (optional; must match the Google OAuth client used in the browser)
- `STRATIQ_LLM_MODE=deterministic|grok|openai`
- `GROK_API_KEY` (optional)
- `OPENAI_API_KEY` (optional)

### Seeded accounts (API bootstrap)

After the API seeds the database, these emails exist with password **`StratIQ-demo-2026`** (bcrypt-hashed in `seed_database`):

- `exec@stratiq.demo` → executive
- `approver@stratiq.demo` → approver
- `analyst@stratiq.demo` → analyst
- `admin@stratiq.demo` → admin
- `viewer@stratiq.demo` → viewer

Self-serve **registration** defaults new users to the **viewer** role. **Google** sign-in creates a **viewer** account on first login.

### Routes

- `/` redirects to `/login`
- App pages require a stored JWT (sign in at `/login`); use **Log out** to switch users
- `/admin/users` is intended for `admin` role accounts
