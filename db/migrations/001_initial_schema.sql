-- StratIQ — Initial Schema (Customer Churn Domain)
-- Run: psql $DATABASE_URL -f 001_initial_schema.sql

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','approver','viewer')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CUSTOMER CHURN DOMAIN
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  industry      TEXT,
  tier          TEXT CHECK (tier IN ('enterprise','mid-market','smb')),
  region        TEXT,
  account_owner TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plan                  TEXT CHECK (plan IN ('basic','pro','enterprise')),
  mrr                   NUMERIC(12,2) NOT NULL DEFAULT 0,
  contract_start        DATE NOT NULL,
  contract_end          DATE NOT NULL,
  renewal_probability   NUMERIC(5,2) DEFAULT 50,   -- 0-100
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','churned','at_risk')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_metrics (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  logins_count     INTEGER DEFAULT 0,
  feature_usage    JSONB DEFAULT '{}',
  api_calls        INTEGER DEFAULT 0,
  support_tickets  INTEGER DEFAULT 0,
  nps_score        NUMERIC(4,1),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, period_start)
);

CREATE TABLE IF NOT EXISTS churn_signals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  signal_type  TEXT NOT NULL CHECK (signal_type IN (
                  'low_usage','missed_renewal','negative_sentiment',
                  'escalation','price_objection','competitor_mention')),
  severity     TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  detected_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  notes        TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- KPI SNAPSHOTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date  DATE NOT NULL,
  workflow       TEXT NOT NULL DEFAULT 'churn',
  metric_name    TEXT NOT NULL,
  metric_value   NUMERIC(15,4),
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(snapshot_date, workflow, metric_name)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RUN CONTEXT (Orchestrator state per question)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  workflow          TEXT NOT NULL DEFAULT 'churn',
  question          TEXT NOT NULL,
  filters           JSONB DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed')),
  -- Agent outputs (stored as JSONB)
  analyst_output    JSONB,
  researcher_output JSONB,
  planner_output    JSONB,
  critique_output   JSONB,
  arbiter_output    JSONB,
  comms_output      JSONB,
  -- Final artifact
  decision_card     JSONB,
  error_message     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTIONS & APPROVALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id         UUID REFERENCES runs(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type    TEXT NOT NULL CHECK (action_type IN (
                   'retention_outreach','strategy_brief',
                   'segment_flag','internal_rec')),
  title          TEXT NOT NULL,
  description    TEXT,
  target_entity  JSONB DEFAULT '{}',   -- {"type":"customer","id":"...","name":"..."}
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                   'pending','approved','rejected','deferred','executed')),
  priority       TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  due_date       DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id    UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  decision     TEXT NOT NULL CHECK (decision IN ('approved','rejected','deferred')),
  notes        TEXT,
  reviewed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FEEDBACK & AUDIT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id     UUID REFERENCES runs(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,   -- 'ask'|'action_create'|'approve'|'reject'|'login'
  entity_type TEXT,            -- 'run'|'action'|'approval'
  entity_id   UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- VECTOR STORE (Unstructured evidence for RAG)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type  TEXT NOT NULL CHECK (source_type IN (
                 'support_ticket','review','survey','policy','internal_note')),
  source_id    TEXT,
  source_title TEXT,
  content      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',  -- {"customer_id":"...","date":"...","sentiment":"negative"}
  embedding    vector(1536),        -- OpenAI text-embedding-3-small
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS idx_doc_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer   ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_customer   ON usage_metrics(customer_id);
CREATE INDEX IF NOT EXISTS idx_churn_signals_customer   ON churn_signals(customer_id);
CREATE INDEX IF NOT EXISTS idx_churn_signals_severity   ON churn_signals(severity);
CREATE INDEX IF NOT EXISTS idx_runs_user                ON runs(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_status           ON actions(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user          ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event         ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date       ON kpi_snapshots(snapshot_date DESC);
