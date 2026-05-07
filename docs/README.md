# StratIQ Docs

Internal reference for how StratIQ is built and how it works. Conventions, schemas, AI conventions, and data flow decisions captured for whoever joins next.

## Index

| File | What it covers |
|---|---|
| [architecture.md](architecture.md) | High-level system: 3 modules, tech stack, mock_ai flag |
| [data-uploads.md](data-uploads.md) | Upload pipeline (structured + unstructured), polling, status lifecycle |
| [upload-templates.md](upload-templates.md) | All 8 template schemas, required/optional columns, use cases, dependency order |
| [churn-signals.md](churn-signals.md) | Structured + AI-extracted signals that drive customer churn scores |
| [survey-signals.md](survey-signals.md) | AI-extracted signals from employee survey free-text |
| [ai-scoring.md](ai-scoring.md) | Rescoring pipeline: when it runs, what it writes |
| [ai-pipeline.md](ai-pipeline.md) | Full chat query pipeline — every step, models used, SSE events, latency budget |
| [ai-chat.md](ai-chat.md) | Ask StratIQ drawer: sessions, multi-turn context, SSE flow |
| [schema-constraints.md](schema-constraints.md) | All DB CHECK constraints / enum values (one place) |
| [database.md](database.md) | Tables grouped by purpose, key relationships |
| [api-endpoints.md](api-endpoints.md) | Backend routes by module |
| [frontend-pages.md](frontend-pages.md) | App pages, key components, data hooks |
| [environment.md](environment.md) | Required env vars (frontend + backend) |
| [conventions.md](conventions.md) | Code conventions, naming, gotchas |

These docs are a snapshot — when behavior changes in code, update the relevant doc.
