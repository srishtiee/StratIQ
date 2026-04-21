-- Chat sessions for multi-turn AI queries.
-- Apply via Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES orgs(id),
  user_id     UUID NOT NULL REFERENCES user_profiles(id),
  module      TEXT CHECK (module IN ('people', 'retention')),
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON chat_sessions (user_id, updated_at DESC);

ALTER TABLE queries
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES chat_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_queries_session
  ON queries (session_id, created_at);
