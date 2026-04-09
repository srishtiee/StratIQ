-- Re-add meeting_ics to the actions.type CHECK constraint.
-- Apply via Supabase SQL Editor.
--
-- Migration 002 narrowed the set to (task, email_send, pdf_report) because
-- meeting_ics had been removed from the codebase. We're reintroducing it as a
-- real artifact-producing action: server generates an .ics calendar invite,
-- uploads it to Storage, and (optionally) emails it to attendees with the
-- .ics file attached. Compatible with Google Calendar, Outlook, Apple Calendar.

ALTER TABLE actions DROP CONSTRAINT IF EXISTS actions_type_check;
ALTER TABLE actions
  ADD CONSTRAINT actions_type_check
  CHECK (type IN ('task', 'email_send', 'pdf_report', 'meeting_ics'));
