# StratIQ

StratIQ is a frontend-first executive decision-support prototype for customer churn strategy workflows.

The Phase 1 implementation focuses on:

- Executive dashboard and KPI views
- Workflow lanes for `Ask`, `Plan/Debate`, and `Approve/Execute`
- Customer drill-down screens
- Approval queue and action summaries
- Shared UI components and typed service contracts
- Thin FastAPI stub for later backend replacement

## Workspace

- `web`: Next.js frontend prototype
- `shared`: shared TypeScript contracts
- `api`: FastAPI stub mirroring the UI-facing contracts

## Quick Start

```bash
npm run dev
```

Open `http://localhost:3000`.

## Current State

The frontend currently runs against typed mock data. The API contract layer is intentionally stable so mock-backed screens can later be switched to real backend endpoints with minimal UI churn.
