-- =============================================================================
-- Migration 008: Strict Multitenancy Hardening
-- This migration closes a critical security gap where any logged-in user could 
-- see data from other tenants (companies). 
-- =============================================================================

-- 1. Redefine the tenant lookup helper to be robust
CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS UUID AS $$
  -- Access profiles table to get the tenant_id mapped to the current auth UUID.
  -- This lookup is fast and cached by Postgres for the duration of the request.
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. List of tables that require STRICT isolation
-- We include EVERYTHING that belongs to an ISP.
DO $$ 
DECLARE
  t text;
  r record;
  tables text[] := ARRAY[
    'profiles', 
    'routers', 
    'packages', 
    'customers', 
    'services', 
    'persons',
    'subscriptions', 
    'invoices', 
    'payments', 
    'provision_logs', 
    'router_sync_logs', 
    'audit_logs', 
    'suspensions', 
    'message_logs', 
    'app_settings',
    'radius_users',
    'mpesa_stk_requests'
  ];
BEGIN
  -- Cycle through all ISP data tables
  FOREACH t IN ARRAY tables LOOP
    -- Step A: Ensure RLS is active
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    
    -- Step B: Drop ALL existing policies to start from a clean, secure slate.
    -- This removes both the overly permissive "Staff sees..." policies 
    -- and any broken recursive policies.
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', r.policyname, t);
    END LOOP;

    -- Step C: Apply the Universal Isolation Rule
    -- Users can only SEE (Select), ADD (Insert), EDIT (Update), or REMOVE (Delete)
    -- data that explicitly matches their own tenant_id.
    EXECUTE format('
      CREATE POLICY "Strict tenant isolation" ON %I FOR ALL
      USING (tenant_id = get_auth_tenant_id())
      WITH CHECK (tenant_id = get_auth_tenant_id());
    ', t);
  END LOOP;
END $$;

-- 3. Special case: profiles table
-- A user must be able to read their own profile even before the tenant context is fully established.
-- But they should NEVER see other users in their own tenant unless they have permission (handled by RLS).
-- We've already dropped old policies above. Let's add the correct ones.
DROP POLICY IF EXISTS "Strict tenant isolation" ON profiles;
CREATE POLICY "Profile self access" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Tenant peers access" ON profiles FOR SELECT USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Profile update self" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 4. Super Admin Emergency Access (Optional, but useful for support)
-- Allows our internal super_admins to bypass isolation if needed for debugging across the whole system.
-- Only uncomment if you have a trusted 'super_admin' role in use.
-- CREATE POLICY "SuperAdmin Global Override" ON customers FOR ALL USING (
--   EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
-- );

-- 5. Data Integrity Audit: Ensure EVERY row carries a tenant_id
-- We already have NOT NULL constraints from Migration 004, but let's be double sure for 'services' and 'persons'
ALTER TABLE services ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE persons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE mpesa_stk_requests ALTER COLUMN tenant_id SET NOT NULL;
