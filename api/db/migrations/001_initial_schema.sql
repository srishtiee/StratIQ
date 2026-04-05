CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT NOT NULL,
  plan TEXT NOT NULL,
  monthly_revenue NUMERIC NOT NULL,
  risk_level TEXT NOT NULL,
  churn_probability NUMERIC NOT NULL,
  health_score INTEGER NOT NULL,
  renewal_date TEXT NOT NULL,
  account_owner TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_metrics (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  period_label TEXT NOT NULL,
  weekly_active_users INTEGER NOT NULL,
  usage_change_pct NUMERIC NOT NULL,
  premium_feature_adoption_pct NUMERIC NOT NULL,
  login_volume INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  snippet TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  request_id TEXT,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  prompt TEXT NOT NULL,
  workflow_type TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata_json JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS run_evidence (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  snippet TEXT NOT NULL,
  relevance TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE REFERENCES workflow_runs(id) ON DELETE CASCADE,
  planner_summary TEXT NOT NULL,
  planner_options JSONB NOT NULL,
  risk_verdict TEXT NOT NULL,
  risk_critique TEXT NOT NULL,
  risk_concerns JSONB NOT NULL,
  risk_required_checks JSONB NOT NULL,
  arbiter_strategy_id TEXT NOT NULL,
  arbiter_final_recommendation TEXT NOT NULL,
  arbiter_rationale TEXT NOT NULL,
  arbiter_confidence_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  action_title TEXT NOT NULL,
  owner TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  actor_id_created_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  executed_by TEXT,
  executed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  rationale TEXT NOT NULL,
  estimated_impact TEXT NOT NULL,
  due_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  audit_note TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  verdict TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
  approval_id TEXT REFERENCES approvals(id) ON DELETE CASCADE,
  request_id TEXT,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_state JSONB,
  after_state JSONB,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
