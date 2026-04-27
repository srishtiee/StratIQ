-- Allow authenticated users to read their own user_profiles row.
--
-- Background: AuthBridge in the frontend signs in via Supabase Auth, then needs
-- to look up org_id from user_profiles via the anon key (with the user's JWT).
-- Supabase enables RLS by default on tables exposed via PostgREST, so without
-- a SELECT policy the read returns 0 rows — the frontend never resolves org_id
-- and every API hook stays disabled.
--
-- This is the canonical Supabase pattern: users can read their own profile,
-- and only their own. Service-role calls (the backend) continue to bypass RLS.
--
-- Apply via Supabase SQL Editor.

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_self" ON user_profiles;

CREATE POLICY "user_profiles_select_self"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());
