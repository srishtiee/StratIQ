-- Allow chat sessions to be deleted even when their queries spawned actions.
--
-- Background: chat_sessions delete cascades to queries (via 001), but
-- actions.query_id had no ON DELETE rule, so the FK blocked the cascade with
-- code 23503 ("violates foreign key constraint actions_query_id_fkey"),
-- which surfaced in the UI as "delete doesn't work".
--
-- Actions are tracked artifacts in their own right — we don't want to delete
-- them when their originating query is gone. SET NULL preserves the action,
-- it just loses its provenance link.
--
-- Apply via Supabase SQL Editor.

ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_query_id_fkey;

ALTER TABLE actions
  ADD CONSTRAINT actions_query_id_fkey
  FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE SET NULL;
