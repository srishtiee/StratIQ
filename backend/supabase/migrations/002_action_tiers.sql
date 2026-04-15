-- Restrict action types to (task, email_send, pdf_report) and add approval tiering.
-- Apply via Supabase SQL Editor.

-- 1. Drop existing actions of types we no longer support.
DELETE FROM actions WHERE type IN ('meeting_ics', 'csv_export');

-- 2. Replace the type CHECK constraint.
ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_type_check;
ALTER TABLE actions
  ADD CONSTRAINT actions_type_check
  CHECK (type IN ('task', 'email_send', 'pdf_report'));

-- 3. Add approval tier column. Default 'low' is safe — only email_send needs to be explicitly mid.
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS approval_tier TEXT
    CHECK (approval_tier IN ('low', 'mid', 'high'))
    DEFAULT 'low';

-- 4. Backfill: existing email_send rows should be mid.
UPDATE actions SET approval_tier = 'mid' WHERE type = 'email_send' AND approval_tier IS NULL;
UPDATE actions SET approval_tier = 'mid' WHERE type = 'email_send' AND approval_tier = 'low';
