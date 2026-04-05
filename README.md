# StratIQ

StratIQ is a dashboard-first, AI-assisted executive decision-support prototype. The main end-to-end workflow is **Customer Churn and Retention**; employee attrition remains **future-ready**.

## Capability Status

- **Implemented**
  - Bounded adversarial workflow: Analyst -> Researcher -> Planner -> Risk/Compliance -> Arbiter -> Comms
  - Dashboard/workflow/approvals/audit/customer detail pages
  - Postgres persistence (Supabase/Postgres-compatible)
  - Request correlation IDs (`X-Request-ID`) across API responses, workflow runs, and audit rows
  - Prototype RBAC with header auth (`X-StratIQ-User-ID`, `X-StratIQ-User-Name`, `X-StratIQ-Role`)
  - Approval/action state transitions with transition audit records
  - Deterministic reasoning default with optional Grok/OpenAI fallback behavior
- **Prototype implementation**
  - Audit trail is writable (not immutable/WORM)
  - Auth is header-based demo mode, not production identity federation
  - Evidence retrieval is deterministic keyword + structured lookup; vector path is only schema-ready
- **Optional / configurable**
  - `STRATIQ_LLM_MODE=grok|openai|deterministic` (default deterministic)
  - Demo auth (`STRATIQ_AUTH_MODE=demo`) vs strict header mode (`strict`)
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
pytest api/tests -q
npm run lint
npm run build:web
```

## Key Environment Variables

- `DATABASE_URL=postgresql+psycopg://stratiq:stratiq@localhost:5432/stratiq`
- `STRATIQ_AUTH_MODE=demo|strict`
- `STRATIQ_LLM_MODE=deterministic|grok|openai`
- `GROK_API_KEY` (optional)
- `OPENAI_API_KEY` (optional)
- `NEXT_PUBLIC_STRATIQ_DEMO_ROLE` / `NEXT_PUBLIC_STRATIQ_DEMO_USER_ID` / `NEXT_PUBLIC_STRATIQ_DEMO_USER_NAME`
- `NEXT_PUBLIC_STRATIQ_ENABLE_ROLE_SWITCHER=true|false` (dev-only testing control; prefer `false` in realistic demos)
