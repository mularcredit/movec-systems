-- =============================================================================
-- Migration 007: Multi-Vendor Network Abstraction Layer
-- Extends routers table with vendor field.
-- Adds radius_users AAA table (the live source-of-truth for RADIUS auth).
-- Adds radius_rate_limit to packages for automatic attribute mapping.
-- SAFE to run on live data — all new columns have safe defaults.
-- =============================================================================

-- =============================================================================
-- STEP 1: Add vendor + config to routers
-- =============================================================================
ALTER TABLE routers
    ADD COLUMN IF NOT EXISTS vendor         TEXT    NOT NULL DEFAULT 'mikrotik',
    ADD COLUMN IF NOT EXISTS vendor_config  JSONB;

-- Constrain vendor to known values
ALTER TABLE routers
    ADD CONSTRAINT routers_vendor_check CHECK (vendor IN ('mikrotik', 'radius'));

COMMENT ON COLUMN routers.vendor IS
    'Network vendor driver. mikrotik = RouterOS API. radius = RADIUS NAS client (any vendor).';
COMMENT ON COLUMN routers.vendor_config IS
    'Vendor-specific config. For radius: {"radius_secret": "...", "nas_ip": "..."}.';

-- =============================================================================
-- STEP 2: Add RADIUS rate-limit attribute to packages
-- =============================================================================
ALTER TABLE packages
    ADD COLUMN IF NOT EXISTS radius_rate_limit TEXT;

-- Auto-populate from existing speed columns where available
UPDATE packages
    SET radius_rate_limit = speed_down_mbps || 'M/' || speed_up_mbps || 'M'
    WHERE radius_rate_limit IS NULL
      AND speed_down_mbps IS NOT NULL
      AND speed_up_mbps IS NOT NULL;

COMMENT ON COLUMN packages.radius_rate_limit IS
    'RADIUS Mikrotik-Rate-Limit attribute. Auto-mapped from speed fields. Format: "10M/5M".';

-- =============================================================================
-- STEP 3: Create radius_users table (The RADIUS AAA source of truth)
-- This table IS the user database that the in-process RADIUS server queries.
-- One row per active service that uses a RADIUS-mode router.
-- Synced automatically on provision/suspend/restore.
-- =============================================================================
CREATE TABLE IF NOT EXISTS radius_users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    router_id       UUID NOT NULL REFERENCES routers(id) ON DELETE CASCADE,

    -- Core credentials
    username            TEXT NOT NULL,
    password_encrypted  TEXT NOT NULL,  -- AES-256-GCM, decrypted at auth request time (PAP)

    -- RADIUS attributes applied on Access-Accept
    rate_limit          TEXT,           -- Mikrotik-Rate-Limit: e.g. "10M/5M"
    framed_ip_address   TEXT,           -- Optional static IP assignment
    session_timeout     INTEGER,        -- Optional max session seconds

    -- Lifecycle
    status      TEXT    NOT NULL DEFAULT 'active', -- active | suspended
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT radius_users_username_unique UNIQUE (username)
);

-- Trigger: auto-update updated_at
CREATE TRIGGER upd_radius_users
    BEFORE UPDATE ON radius_users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- RLS
ALTER TABLE radius_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Isolated tenant access" ON radius_users
    FOR ALL USING (tenant_id = get_auth_tenant_id())
    WITH CHECK (tenant_id = get_auth_tenant_id());

-- Index for auth lookups (hot path — RADIUS queries by username on every login)
CREATE INDEX IF NOT EXISTS idx_radius_users_username ON radius_users (username);
CREATE INDEX IF NOT EXISTS idx_radius_users_service  ON radius_users (service_id);
