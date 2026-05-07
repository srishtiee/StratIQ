# Frontend Pages

Next.js 16 App Router. All pages live under `frontend/app/(main)/` with shared layout in `frontend/app/(main)/layout.tsx`.

State: TanStack Query v5. All data hooks live in `frontend/lib/api/hooks.ts`. Types in `frontend/lib/api/types.ts`.

## Routes

| Route | Page file | Purpose |
|---|---|---|
| `/dashboard` | `(main)/dashboard/page.tsx` | Executive overview — KPI cards, morning brief, alerts, recommended actions, KPI trend charts |
| `/people` | `(main)/people/page.tsx` | Employee risk table + risk distribution + comp insights + slideover |
| `/retention` | `(main)/retention/page.tsx` | Customer churn table + health distribution + at-risk accounts + slideover |
| `/actions` | `(main)/actions/page.tsx` | All actions across modules — drafts, pending approval, in progress, completed, failed |
| `/uploads` | `(main)/uploads/page.tsx` | Upload UI — template selector, drop zone, history table, downloadable templates |
| `/settings` | `(main)/settings/*` | Settings (placeholder) |

## Component organization

```
frontend/components/
  shared/          ← cross-page (KpiCard, PageHeader, ActionModal)
  dashboard/      ← morning-brief, alert-feed, pending-approvals, recent-actions
  people/         ← employee-risk-table
  retention/      ← churn-table
  actions/        ← execution-log
  charts/         ← AreaChartComponent (Recharts wrapper)
  layout/         ← sidebar, topbar
  ui/             ← shadcn primitives (button, badge, input, ...)
```

## Hooks → endpoint map

| Hook | Endpoint | Used by |
|---|---|---|
| `useEmployees(department?)` | `GET /people/employees` | People page |
| `usePeopleSummary()` | `GET /people/summary` | Dashboard, People |
| `useCustomers(segment?)` | `GET /retention/customers` | Retention page |
| `useRetentionSummary()` | `GET /retention/summary` | Dashboard, Retention |
| `useActions(status?)` | `GET /actions/` | All pages with action UI |
| `useDashboardKpis()` | `GET /dashboard/kpis` | (reserved) |
| `useKpiHistory(name?)` | `GET /dashboard/kpis/history` | Dashboard charts |
| `useAlerts()` | `GET /dashboard/alerts` | Alert feed |
| `useMorningBrief()` | `GET /dashboard/morning-brief` | Morning brief card (1hr stale) |
| `useUploads()` | `GET /uploads/` | Upload history |
| `useUploadFile()` | `POST /uploads/` | File upload mutation (FormData) |
| `useUploadStatus(id)` | `GET /uploads/{id}` | Polls every 2s, stops on `complete`/`error` |
| `useApproveAction()` | `PATCH /actions/{id}/approve` | Pending approvals |
| `useRejectAction()` | `PATCH /actions/{id}/reject` | Pending approvals |
| `useExecuteAction()` | `POST /actions/{id}/execute` | Drafts table |

## Provider setup

`frontend/app/providers.tsx` wraps the app in `QueryClientProvider`. Default `staleTime: 30s`, `retry: 1`. Wrapped from `app/layout.tsx`.

## API client

`frontend/lib/api/client.ts`:
- `API_BASE` = `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api/v1`)
- `ORG_ID` = `NEXT_PUBLIC_ORG_ID`
- `USER_ID` = `NEXT_PUBLIC_USER_ID`
- `apiFetch<T>(path, options?)` — base wrapper with JSON content-type and error throwing

Mutations that need FormData (file upload) use raw `fetch`, not `apiFetch`.

## Type conventions

API shapes are prefixed `Api*` to distinguish from any UI-only types: `ApiEmployee`, `ApiCustomer`, `ApiAction`, `ApiKpi`, `ApiKpiHistory`, `ApiNotification`, `ApiUploadedFile`.

Field name pitfalls (matched to backend):
- `original_filename` (not `filename`) on `ApiUploadedFile`
- `source_module` (not `module`) on `ApiAction`
- `executed_at` (not `updated_at`) on `ApiAction`
- `latest_attrition_risk_score` / `latest_churn_score` for risk fields
- `user_profiles?.name` — nested CSM name (PostgREST FK join on `customers.csm_id`)
