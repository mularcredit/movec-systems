-- Enterprise ISP Platform Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'technician', 'support', 'accountant');
CREATE TYPE customer_status AS ENUM ('active', 'suspended', 'pending', 'cancelled', 'expired');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE invoice_status AS ENUM ('unpaid', 'paid', 'overdue', 'cancelled');
CREATE TYPE connection_type AS ENUM ('direct', 'wireguard', 'openvpn');
CREATE TYPE router_sync_status AS ENUM ('synced', 'pending', 'failed', 'offline');

-- 1. PROFILES
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role DEFAULT 'support',
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ROUTERS (Enterprise Setup)
CREATE TABLE routers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT,
    ip_address TEXT NOT NULL,
    api_port INTEGER DEFAULT 8728,
    username_encrypted TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    
    -- Connection Architecture properties (WireGuard payload mappings)
    conn_type connection_type DEFAULT 'direct',
    tunnel_ip TEXT,
    endpoint_host TEXT,
    endpoint_port INTEGER,
    router_public_key TEXT,
    server_public_key TEXT,
    allowed_ips TEXT,
    keepalive INTEGER DEFAULT 25,
    
    -- Status and Monitoring
    is_active BOOLEAN DEFAULT true,
    sync_status router_sync_status DEFAULT 'pending',
    router_os_version TEXT,
    total_users INTEGER DEFAULT 0,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    connection_status TEXT DEFAULT 'offline',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PACKAGES
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    service_type TEXT NOT NULL, -- e.g., 'PPPoE', 'Hotspot', 'Static'
    speed_down_mbps NUMERIC NOT NULL,
    speed_up_mbps NUMERIC NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    billing_cycle_months INTEGER DEFAULT 1,
    validity_days INTEGER DEFAULT 30, -- specifically for Hotspot models
    burst_config TEXT, -- 'burst-limit/burst-threshold/burst-time'
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CUSTOMERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    account_number TEXT UNIQUE NOT NULL,
    email TEXT,
    phone TEXT,
    national_id TEXT,
    address TEXT,
    installation_location TEXT,
    
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    package_id UUID REFERENCES packages(id) ON DELETE RESTRICT,
    service_type TEXT NOT NULL DEFAULT 'PPPoE',
    
    -- Operations Secrets
    username TEXT UNIQUE, -- PPPoE or Hotspot username
    password_encrypted TEXT,
    ip_address TEXT,
    mac_address TEXT,
    
    -- Billing Status
    status customer_status DEFAULT 'pending',
    next_due_date DATE,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SUBSCRIPTIONS
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INVOICES
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount_due NUMERIC(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    status invoice_status DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. PAYMENTS
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    method TEXT DEFAULT 'M-Pesa',
    transaction_code TEXT UNIQUE,
    status payment_status DEFAULT 'completed',
    notes TEXT,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. ROUTER_SYNC_LOGS
CREATE TABLE router_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    router_id UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'success', 'failed'
    details TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. APP_SETTINGS
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 11. SUSPENSIONS
CREATE TABLE suspensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    suspended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reconnected_at TIMESTAMP WITH TIME ZONE,
    suspended_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 12. COMMUNICATION & MESSAGE LOGS (SMS/Email)
CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL, -- 'sms', 'email'
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    gateway_response TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

---------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
---------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE routers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access" ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Service roles handles router access" ON routers FOR ALL USING (
    (auth.role() = 'service_role') OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Staff sees customers" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff sees packages" ON packages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Staff sees payments" ON payments FOR SELECT USING (auth.role() = 'authenticated');

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER upd_routers BEFORE UPDATE ON routers FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER upd_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE TRIGGER upd_packages BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- =================================================================
-- APP SETTINGS (key-value store for platform configuration)
-- =================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO app_settings (key, value) VALUES
  ('sms_sender_type',   'shared'),
  ('sms_sender_id',     'MOVEC')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage settings" ON app_settings FOR ALL USING (auth.role() = 'authenticated');

-- CREATE PROVISION LOGS TABLE
CREATE TABLE IF NOT EXISTS provision_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    router_id UUID REFERENCES routers(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
