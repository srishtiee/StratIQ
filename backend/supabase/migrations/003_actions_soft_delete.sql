-- Soft delete for the actions table.
-- Apply via Supabase SQL Editor.

ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Speed up the "live actions only" filter used by list/get endpoints.
CREATE INDEX IF NOT EXISTS idx_actions_org_alive
  ON actions (org_id, created_at DESC)
  WHERE deleted_at IS NULL;
