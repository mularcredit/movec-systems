-- =============================================================================
-- Migration 005: Enterprise ISP Data Model (Phase 2)
-- Enables decoupled tracking: Persons -> Properties -> Units -> Services
-- Improves billing integrity by linking invoices to specific services natively.
-- =============================================================================

-- 1. Create Core Master Data
CREATE TABLE IF NOT EXISTS persons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) DEFAULT get_auth_tenant_id(),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) DEFAULT get_auth_tenant_id(),
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Services (Takes over technical config + billing ledger)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) DEFAULT get_auth_tenant_id(),
    person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    package_id UUID REFERENCES packages(id) ON DELETE RESTRICT,
    account_number TEXT UNIQUE NOT NULL,
    
    service_type TEXT NOT NULL DEFAULT 'PPPoE',
    username TEXT UNIQUE,
    password_encrypted TEXT,
    ip_address TEXT,
    mac_address TEXT,
    
    status customer_status DEFAULT 'pending',
    next_due_date DATE,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update Existing Billing Interlocks for the New Era
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id) ON DELETE CASCADE;
ALTER TABLE invoices ALTER COLUMN customer_id DROP NOT NULL;

-- Ensure an invoice is strictly unique per billing cycle (One invoice per customer per due date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_invoice_customer ON invoices (customer_id, due_date) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_invoice_service ON invoices (service_id, due_date) WHERE service_id IS NOT NULL;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id) ON DELETE CASCADE;
ALTER TABLE payments ALTER COLUMN customer_id DROP NOT NULL;

-- 4. Enable Configuration Upgrades
ALTER TABLE packages ADD COLUMN IF NOT EXISTS grace_days INTEGER DEFAULT 0;

-- 5. Create STK Push Tracker Table (Resolves missing Daraja AccountReference lookup!)
CREATE TABLE IF NOT EXISTS mpesa_stk_requests (
    checkout_request_id TEXT PRIMARY KEY,
    merchant_request_id TEXT,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE DEFAULT get_auth_tenant_id(),
    account_number TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, success, failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Hardwire Security
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_stk_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Isolated tenant access" ON persons FOR ALL USING (tenant_id = get_auth_tenant_id()) WITH CHECK (tenant_id = get_auth_tenant_id());
CREATE POLICY "Isolated tenant access" ON properties FOR ALL USING (tenant_id = get_auth_tenant_id()) WITH CHECK (tenant_id = get_auth_tenant_id());
CREATE POLICY "Isolated tenant access" ON services FOR ALL USING (tenant_id = get_auth_tenant_id()) WITH CHECK (tenant_id = get_auth_tenant_id());
CREATE POLICY "Isolated tenant access" ON mpesa_stk_requests FOR ALL USING (tenant_id = get_auth_tenant_id()) WITH CHECK (tenant_id = get_auth_tenant_id());

-- Units inherits RLS based on its property
CREATE POLICY "Isolated tenant access" ON units FOR ALL USING (
    EXISTS(SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.tenant_id = get_auth_tenant_id())
) WITH CHECK (
    EXISTS(SELECT 1 FROM properties WHERE properties.id = units.property_id AND properties.tenant_id = get_auth_tenant_id())
);

-- Triggers
CREATE TRIGGER upd_persons BEFORE UPDATE ON persons FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER upd_properties BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER upd_units BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER upd_services BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
