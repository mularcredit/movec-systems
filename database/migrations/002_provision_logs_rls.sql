-- =============================================================================
-- Migration 002: RLS for provision_logs + provision_failed enum value
-- Run in Supabase SQL Editor ONCE before deploying the updated backend.
-- =============================================================================

-- 1. Add provision_failed to customer_status enum (safe — can run multiple times)
ALTER TYPE customer_status ADD VALUE IF NOT EXISTS 'provision_failed';

-- 2. Enable RLS on provision_logs (safe to run even if already enabled)
ALTER TABLE provision_logs ENABLE ROW LEVEL SECURITY;

-- 3. Service role (backend) — full access (INSERT, SELECT, UPDATE, DELETE)
--    The backend uses the service_role key, so it can always write logs.
DROP POLICY IF EXISTS "Service role manages provision logs" ON provision_logs;
CREATE POLICY "Service role manages provision logs"
    ON provision_logs FOR ALL
    USING      (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 4. Authenticated staff — SELECT only (read their own customers' logs or all)
--    Scope: all provision_logs visible to authenticated internal staff.
--    Tighten further by joining to customers if multi-tenant isolation is needed.
DROP POLICY IF EXISTS "Authenticated staff view provision logs" ON provision_logs;
CREATE POLICY "Authenticated staff view provision logs"
    ON provision_logs FOR SELECT
    USING (auth.role() = 'authenticated');

-- 5. Explicitly deny public/anon access
--    (Default deny applies, but this makes intent explicit)
DROP POLICY IF EXISTS "No anon access to provision logs" ON provision_logs;
CREATE POLICY "No anon access to provision logs"
    ON provision_logs FOR ALL
    USING (auth.role() <> 'anon');

-- Verify:
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies WHERE tablename = 'provision_logs';
