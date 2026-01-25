-- StratIQ v1 — Full Database Schema
-- Run this against your Supabase project (SQL Editor or supabase db push)
-- Requires: pgvector extension

-- ────────────────────────────────────────────────────────────
-- Extensions
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;


-- ────────────────────────────────────────────────────────────
-- Tenancy & Auth
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id     UUID PRIMARY KEY REFERENCES auth.users(id),
  org_id UUID NOT NULL REFERENCES orgs(id),
  name   TEXT,
  role   TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer'))
);


-- ────────────────────────────────────────────────────────────
-- People Intelligence
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id),
  name             TEXT NOT NULL,
  email            TEXT,
  department       TEXT,
  role             TEXT,
  level            TEXT,
  location         TEXT,
  hire_date        DATE,
  termination_date DATE,
  manager_id       UUID REFERENCES employees(id),
  skills           TEXT[],
  status           TEXT DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'on_leave')),
  latest_attrition_risk_score  NUMERIC(4,2),
  latest_engagement_score      NUMERIC(4,2),
  latest_performance_score     NUMERIC(4,2),
  scores_last_updated_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_employees_org_dept    ON employees (org_id, department);
CREATE INDEX IF NOT EXISTS idx_employees_org_status  ON employees (org_id, status);

CREATE TABLE IF NOT EXISTS compensation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES orgs(id),
  employee_id      UUID NOT NULL REFERENCES employees(id) UNIQUE,
  salary           NUMERIC(12,2),
  bonus            NUMERIC(12,2),
  equity           NUMERIC(12,2),
  market_benchmark NUMERIC(12,2),
  compa_ratio      NUMERIC(5,4),
  last_review_date DATE,
  currency         TEXT DEFAULT 'USD',
  effective_date   DATE
);

CREATE TABLE IF NOT EXISTS compensation_bands (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  role           TEXT NOT NULL,
  level          TEXT NOT NULL,
  location       TEXT NOT NULL,
  market_min     NUMERIC(12,2),
  market_mid     NUMERIC(12,2),
  market_max     NUMERIC(12,2),
  source         TEXT,
  effective_date DATE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, role, level, location)
);

CREATE TABLE IF NOT EXISTS survey_rounds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  name       TEXT NOT NULL,
  period     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- uploaded_files defined before survey_responses because survey_responses.file_id references it
CREATE TABLE IF NOT EXISTS uploaded_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  user_id           UUID NOT NULL REFERENCES user_profiles(id),
  original_filename TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  file_type         TEXT CHECK (file_type IN ('csv', 'xlsx', 'txt', 'pdf')),
  template_type     TEXT CHECK (template_type IN (
                      'employees', 'compensation', 'compensation_bands',
                      'customers', 'churn_signals',
                      'survey_responses', 'csm_notes', 'kpis'
                    )),
  round_id          UUID REFERENCES survey_rounds(id),
  status            TEXT DEFAULT 'pending' CHECK (status IN (
                      'pending', 'validating', 'processing', 'complete', 'error'
                    )),
  row_count         INT,
  error_message     TEXT,
  processed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES orgs(id),
  employee_id          UUID NOT NULL REFERENCES employees(id),
  round_id             UUID REFERENCES survey_rounds(id),
  file_id              UUID REFERENCES uploaded_files(id),
  raw_text             TEXT NOT NULL,
  ai_extracted_signals JSONB,
  sentiment_score      NUMERIC(3,2),
  processed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_emp    ON survey_responses (org_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_round  ON survey_responses (round_id);

CREATE TABLE IF NOT EXISTS employee_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES orgs(id),
  employee_id               UUID NOT NULL REFERENCES employees(id),
  attrition_risk_score      NUMERIC(4,2),
  engagement_score          NUMERIC(4,2),
  performance_score         NUMERIC(4,2),
  promotion_readiness_score NUMERIC(4,2),
  scored_at                 TIMESTAMPTZ DEFAULT now(),
  trigger_type              TEXT CHECK (trigger_type IN ('initial', 'upload', 'query', 'scheduled')),
  trigger_source_id         UUID,
  ai_rationale              TEXT,
  contributing_factors      JSONB
);
CREATE INDEX IF NOT EXISTS idx_employee_scores_emp ON employee_scores (employee_id, scored_at DESC);


-- ────────────────────────────────────────────────────────────
-- Customer Retention
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  name           TEXT NOT NULL,
  segment        TEXT,
  tier           TEXT,
  arr            NUMERIC(14,2),
  csm_id         UUID REFERENCES user_profiles(id),
  renewal_date   DATE,
  contract_start DATE,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active', 'churned', 'renewed')),
  latest_churn_score      NUMERIC(4,2),
  latest_health_score     NUMERIC(4,2),
  latest_revenue_at_risk  NUMERIC(14,2),
  scores_last_updated_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, name)
);
CREATE INDEX IF NOT EXISTS idx_customers_org_segment ON customers (org_id, segment);
CREATE INDEX IF NOT EXISTS idx_customers_org_status  ON customers (org_id, status);

CREATE TABLE IF NOT EXISTS churn_signals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  signal_type TEXT CHECK (signal_type IN ('usage', 'nps', 'support', 'login', 'csat')),
  value       NUMERIC(10,4),
  recorded_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_churn_signals_cust ON churn_signals (customer_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS customer_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  customer_id       UUID NOT NULL REFERENCES customers(id),
  churn_score       NUMERIC(4,2),
  health_score      NUMERIC(4,2),
  revenue_at_risk   NUMERIC(14,2),
  scored_at         TIMESTAMPTZ DEFAULT now(),
  trigger_type      TEXT CHECK (trigger_type IN ('initial', 'upload', 'query', 'scheduled')),
  trigger_source_id UUID,
  ai_rationale      TEXT,
  contributing_factors JSONB
);
CREATE INDEX IF NOT EXISTS idx_customer_scores_cust ON customer_scores (customer_id, scored_at DESC);

CREATE TABLE IF NOT EXISTS csm_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  author_id   UUID REFERENCES user_profiles(id),
  file_id     UUID REFERENCES uploaded_files(id),
  note_type   TEXT CHECK (note_type IN ('call', 'qbr', 'email', 'escalation', 'renewal', 'onboarding')),
  meeting_date DATE,
  raw_text    TEXT NOT NULL,
  ai_extracted_signals JSONB,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csm_notes_cust ON csm_notes (org_id, customer_id);


-- ────────────────────────────────────────────────────────────
-- RAG / Vector Search
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  source_type TEXT CHECK (source_type IN (
                'survey_response', 'csm_note', 'compensation_policy', 'uploaded_doc'
              )),
  source_id   UUID NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1536),
  entity_type TEXT CHECK (entity_type IN ('employee', 'customer')),
  entity_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_entity ON document_chunks (org_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_ivfflat ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC: entity-filtered cosine similarity search
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  org_id_param    UUID,
  top_k           INT DEFAULT 5,
  entity_type_param TEXT DEFAULT NULL,
  entity_ids_param  UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  source_type TEXT,
  source_id   UUID,
  content     TEXT,
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.source_type,
    dc.source_id,
    dc.content,
    dc.entity_type,
    dc.entity_id,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE dc.org_id = org_id_param
    AND (entity_type_param IS NULL OR dc.entity_type = entity_type_param)
    AND (entity_ids_param IS NULL OR dc.entity_id = ANY(entity_ids_param))
  ORDER BY dc.embedding <=> query_embedding
  LIMIT top_k;
END;
$$;

-- RPC: safe read-only query executor (used by the SQL Analyst step)
-- Wraps arbitrary SQL in a read-only transaction
CREATE OR REPLACE FUNCTION execute_read_query(sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  -- Block non-SELECT statements
  IF upper(trim(sql)) !~ '^SELECT' THEN
    RAISE EXCEPTION 'Only SELECT statements are allowed';
  END IF;
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


-- ────────────────────────────────────────────────────────────
-- AI Agent Layer
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  user_id     UUID NOT NULL REFERENCES user_profiles(id),
  module      TEXT CHECK (module IN ('people', 'retention')),
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS queries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  user_id           UUID NOT NULL REFERENCES user_profiles(id),
  session_id        UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  module            TEXT CHECK (module IN ('people', 'retention')),
  question          TEXT NOT NULL,
  intent_classified TEXT,
  needs_sql         BOOL,
  needs_rag         BOOL,
  sql_generated     TEXT,
  rag_chunks_used   UUID[],
  sources           JSONB,
  response          JSONB,
  critique_issues   JSONB,
  latency_ms        INT,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_queries_session ON queries (session_id, created_at);

CREATE TABLE IF NOT EXISTS ai_analysis_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES orgs(id),
  trigger_type      TEXT CHECK (trigger_type IN ('initial', 'upload', 'query', 'scheduled')),
  trigger_id        UUID,
  module            TEXT CHECK (module IN ('people', 'retention')),
  entities_analyzed INT,
  model_used        TEXT,
  latency_ms        INT,
  status            TEXT CHECK (status IN ('running', 'complete', 'failed')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_entity_reasoning (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES orgs(id),
  run_id       UUID NOT NULL REFERENCES ai_analysis_runs(id),
  entity_type  TEXT CHECK (entity_type IN ('employee', 'customer')),
  entity_id    UUID NOT NULL,
  reasoning    TEXT NOT NULL,
  score_before NUMERIC(4,2),
  score_after  NUMERIC(4,2),
  delta        NUMERIC(4,2),
  factors      JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_reasoning_entity ON ai_entity_reasoning (entity_type, entity_id, created_at DESC);


-- ────────────────────────────────────────────────────────────
-- Actions & Execution
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES orgs(id),
  user_id            UUID NOT NULL REFERENCES user_profiles(id),
  type               TEXT NOT NULL CHECK (type IN (
                       'task', 'email_send', 'pdf_report'
                     )),
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                       'draft', 'pending_approval', 'approved',
                       'executing', 'completed', 'rejected', 'failed'
                     )),
  approval_tier      TEXT CHECK (approval_tier IN ('low', 'mid', 'high')) DEFAULT 'low',
  title              TEXT,
  description        TEXT,
  source_module      TEXT CHECK (source_module IN ('people', 'retention', 'dashboard')),
  source_entity_type TEXT CHECK (source_entity_type IN ('employee', 'customer')),
  source_entity_id   UUID,
  query_id           UUID REFERENCES queries(id),
  due_date           DATE,
  priority           TEXT CHECK (priority IN ('high', 'medium', 'low')),
  payload            JSONB,
  result             JSONB,
  approved_by        UUID REFERENCES user_profiles(id),
  rejected_reason    TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  executed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_actions_org_status ON actions (org_id, status);
CREATE INDEX IF NOT EXISTS idx_actions_entity     ON actions (source_entity_type, source_entity_id);

CREATE TABLE IF NOT EXISTS generated_files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES orgs(id),
  action_id             UUID NOT NULL REFERENCES actions(id),
  file_type             TEXT CHECK (file_type IN ('pdf', 'csv', 'xlsx', 'ics')),
  storage_path          TEXT,
  signed_url            TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  refreshed_at          TIMESTAMPTZ,
  file_size_bytes       INT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execution_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id),
  action_id  UUID NOT NULL REFERENCES actions(id),
  event      TEXT NOT NULL,
  actor_id   UUID REFERENCES user_profiles(id),
  detail     JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES orgs(id),
  user_id        UUID NOT NULL REFERENCES user_profiles(id),
  type           TEXT CHECK (type IN (
                   'action_pending_approval', 'action_completed', 'action_failed',
                   'scores_updated', 'upload_complete'
                 )),
  reference_type TEXT,
  reference_id   UUID,
  message        TEXT,
  read           BOOL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT now()
);


-- ────────────────────────────────────────────────────────────
-- Dashboard
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kpis (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  name        TEXT NOT NULL,
  category    TEXT CHECK (category IN ('hr', 'customer', 'finance', 'ops')),
  value       NUMERIC(14,4),
  target      NUMERIC(14,4),
  unit        TEXT,
  period      TEXT,
  trend       TEXT CHECK (trend IN ('up', 'down', 'flat')),
  description TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS morning_briefs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES orgs(id),
  user_id      UUID NOT NULL REFERENCES user_profiles(id),
  content      TEXT NOT NULL,
  brief_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  valid_until  TIMESTAMPTZ,
  UNIQUE (org_id, user_id, brief_date)
);


-- ────────────────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE orgs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE compensation_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_rounds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_signals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE csm_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files     ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_entity_reasoning ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis               ENABLE ROW LEVEL SECURITY;
ALTER TABLE morning_briefs     ENABLE ROW LEVEL SECURITY;

-- Helper: returns the org_id for the currently authenticated user
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID
LANGUAGE sql STABLE AS $$
  SELECT org_id FROM user_profiles WHERE id = auth.uid()
$$;

-- Policy template: users can only see rows from their own org
-- Applied to tables that have a direct org_id column
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'employees','compensation','compensation_bands','survey_rounds','survey_responses',
    'employee_scores','customers','churn_signals','customer_scores','csm_notes',
    'uploaded_files','document_chunks','queries','ai_analysis_runs','ai_entity_reasoning',
    'actions','execution_logs','kpis','morning_briefs'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY org_isolation ON %I FOR ALL USING (org_id = auth_org_id())',
      tbl
    );
  END LOOP;
END;
$$;

-- Notifications: users see only their own
CREATE POLICY user_isolation ON notifications FOR ALL
  USING (user_id = auth.uid() AND org_id = auth_org_id());

-- Generated files: inherits org via action
CREATE POLICY org_isolation ON generated_files FOR ALL
  USING (org_id = auth_org_id());
