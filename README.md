# StratIQ

StratIQ is a dashboard-first executive decision-support platform for CXO workflows. This repository implements a customer-churn vertical slice from query to recommendation to approval logging, while keeping the architecture extensible for employee attrition later.

## What This Build Includes

- Next.js executive dashboard and workflow UI
- FastAPI backend with intent-aware reasoning and approval persistence
- Postgres-ready persistence designed for Supabase or local Postgres
- 14 seeded churn demo accounts across distinct risk archetypes
- Approval queue and action logging
- Audit history and customer drill-down pages
- Shared typed contracts across frontend and backend

## Reasoning Flow

This repo does not implement an open-ended debate loop. The active workflow is a predictable critique-and-decision sequence:

1. Analyst Agent reviews structured churn signals
2. Researcher Agent retrieves support and renewal evidence
3. Planner Agent proposes one or two intervention strategies
4. Risk/Compliance Agent critiques the proposed path
5. Arbiter Agent selects the most defensible recommendation
6. Comms Agent formats the final executive-facing response

The UI keeps the lane mental model:

- `Ask`
- `Plan / Debate`
- `Approve / Execute`

The center lane shows structured evidence, strategy, critique, and judgment rather than a looping transcript.

## Repo Layout

- `web/`: Next.js app router frontend
- `api/`: FastAPI backend, intent classification, LLM provider abstraction, and fallback reasoning
- `shared/`: shared TypeScript contracts
- `db/`: Postgres schema and seed SQL for local bootstrap

## Local Startup

### 1. Install dependencies

Frontend:

```bash
npm install
```

Backend:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
```

### 2. Create environment config

Copy the sample environment file and update values if needed:

```bash
cp .env.example .env.local
```
LLM configuration supports OpenAI, Groq, and Anthropic.

For final-quality OpenAI reasoning:

```env
STRATIQ_LLM_ENABLED=true
STRATIQ_LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
STRATIQ_OPENAI_MODEL=gpt-4o
```

For free or low-cost development with Groq:

```env
STRATIQ_LLM_ENABLED=true
STRATIQ_LLM_PROVIDER=groq
GROQ_API_KEY=your-key
STRATIQ_GROQ_MODEL=llama-3.3-70b-versatile
```

Important variables:

- `NEXT_PUBLIC_STRATIQ_API_URL=http://localhost:8000`
- `DATABASE_URL=postgresql+psycopg://stratiq:stratiq@localhost:5432/stratiq`
- `STRATIQ_AUTO_INIT_DB=true`
- `STRATIQ_LLM_ENABLED=true`
- `STRATIQ_LLM_PROVIDER=openai`
- `OPENAI_API_KEY=your-key`
- `STRATIQ_OPENAI_MODEL=gpt-4o`

For Supabase, replace `DATABASE_URL` with the project Postgres connection string. The backend uses Postgres directly, so Supabase works as the hosted database layer.

If OpenAI fails because of quota or rate limits, the provider layer can fall back to Groq when configured. If no LLM provider succeeds, the backend returns a deterministic, company-specific recommendation.

### 3. Start Postgres

If you want a local database:

```bash
docker compose up -d postgres
```

This uses:

- [`db/schema.sql`](/Users/khushi/Desktop/StratIQ/db/schema.sql)
- [`db/seed.sql`](/Users/khushi/Desktop/StratIQ/db/seed.sql)

The FastAPI app can also auto-create the schema and seed data when `STRATIQ_AUTO_INIT_DB=true`.

### 4. Run the backend

```bash
npm run dev:api
```

API base URL: `http://localhost:8000`

Available endpoints:

- `GET /health`
- `GET /api/insights`
- `GET /api/customers`
- `GET /api/customers/{id}`
- `POST /api/ask`
- `POST /api/action`
- `POST /api/feedback`
- `GET /api/approvals`
- `GET /api/audit`

### 5. Run the frontend

```bash
npm run dev:web
```

Open `http://localhost:3000`.

If you want both processes together:

```bash
npm run dev:all
```

## Demo Story

The current build supports this walkthrough:

1. Open `/dashboard`
2. Inspect high-risk accounts such as Northstar Fiber
3. Open `/workflow`
4. Ask why churn risk increased or which retention action should be approved
5. Review:
   - summary
   - evidence
   - planner strategies
   - risk critique
   - arbiter decision
   - approval package
6. Open `/approvals`
7. Approve, mark ready, reject, or execution-log the action
8. Open `/audit` to inspect persisted workflow and action history
9. Open `/customers/:id` to review account-level evidence and prior runs

## Manual Acceptance Prompts

Use these with `POST /api/ask` or the `/workflow` page:

- `Why is Northstar Fiber at risk?`
- `What should we approve first for Northstar Fiber?`
- `Is Aster Retail Group mainly a pricing risk or adoption risk?`
- `What evidence supports the recommendation for Orion Capital Services?`
- `Can we avoid discounting for BlueHarbor Logistics?`

Expected result: the selected customer, evidence, strategy, critique, final recommendation, approval card, and audit record should differ by prompt and account.

## Developer Scripts

- `npm run dev:web`
- `npm run dev:api`
- `npm run dev:all`
- `npm run build:web`
- `npm run lint`
- `npm run typecheck`

## Implementation Notes

- The backend uses LLM-first structured reasoning when configured, with deterministic fallback for demo reliability.
- The provider abstraction supports OpenAI, Groq, and Anthropic without exposing keys to the frontend.
- Mock data is still present in the frontend as a graceful fallback if the API is unavailable during development.
