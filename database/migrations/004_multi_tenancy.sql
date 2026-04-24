-- =============================================================================
-- Migration 004: Strict Multi-Tenancy Architecture
-- Run in Supabase SQL Editor ONCE before deploying the updated backend/frontend.
-- Safe to run on live data — all steps handle existing data natively via backfill.
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE TENANTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 2: CREATE DEFAULT TENANT FOR EXISTING DATA BACKFILL
-- =============================================================================
INSERT INTO tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Movec Connect Base Tenant')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 3: ADD tenant_id TO ALL CORE TABLES
-- =============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE routers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE provision_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE router_sync_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE suspensions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- =============================================================================
-- STEP 4: BACKFILL EXISTING DATA TO DEFAULT TENANT
-- =============================================================================
UPDATE profiles SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE routers SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE packages SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE customers SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE subscriptions SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE invoices SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE payments SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE provision_logs SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE router_sync_logs SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE audit_logs SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE suspensions SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
UPDATE message_logs SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;

-- =============================================================================
-- STEP 5: ENFORCE NOT NULL CONSTRAINTS
-- =============================================================================
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE routers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE packages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE provision_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE router_sync_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE suspensions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE message_logs ALTER COLUMN tenant_id SET NOT NULL;

-- Note: app_settings was globally shared configuration. We should probably either keep it global or scope it. Let's not make it multitenant unless prompted, but we should restrict frontend settings modifications to Super Admins.
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
UPDATE app_settings SET tenant_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE tenant_id IS NULL;
ALTER TABLE app_settings ALTER COLUMN tenant_id SET NOT NULL;
-- Recreate Primary Key for app_settings to include tenant_id
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (tenant_id, key);

-- =============================================================================
-- STEP 6: ROW LEVEL SECURITY (RLS) TENANT ISOLATION
-- =============================================================================
-- Note: A helper function avoids repetitive subqueries
CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE provision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE router_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Apply Default Values for implicit INSERT assignments
ALTER TABLE routers ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE packages ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE customers ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE subscriptions ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE invoices ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE payments ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE provision_logs ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE router_sync_logs ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE suspensions ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE message_logs ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();
ALTER TABLE app_settings ALTER COLUMN tenant_id SET DEFAULT get_auth_tenant_id();

-- Tenants Policy (Users can see their own tenant details)
DROP POLICY IF EXISTS "Tenant isolation" ON tenants;
CREATE POLICY "Tenant isolation" ON tenants FOR SELECT
  USING (id = get_auth_tenant_id());

-- Drop old broad policies if any exist
DROP POLICY IF EXISTS "Staff sees customers" ON customers;
DROP POLICY IF EXISTS "Staff sees packages" ON packages;
DROP POLICY IF EXISTS "Staff sees payments" ON payments;

-- Universal Tenant Isolation Rule: Authenticated users can fully manage their tenant data
DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY['profiles', 'routers', 'packages', 'customers', 'subscriptions', 'invoices', 'payments', 'provision_logs', 'router_sync_logs', 'audit_logs', 'suspensions', 'message_logs', 'app_settings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Isolated tenant access" ON %I;', t);
    EXECUTE format('
      CREATE POLICY "Isolated tenant access" ON %I FOR ALL
      USING (tenant_id = get_auth_tenant_id())
      WITH CHECK (tenant_id = get_auth_tenant_id());
    ', t);
  END LOOP;
END $$;

-- Service Role Bailout: 
-- The backend API accesses the DB via service_role. Supabase naturally exempts
-- service_role from RLS bypassing. Thus the SQL changes alone don't prevent cross-tenant backend access. 
-- The backend codebase itself MUST explicitly enforce "WHERE tenant_id = XYZ" in its controllers.
