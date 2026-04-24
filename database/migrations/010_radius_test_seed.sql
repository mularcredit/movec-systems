-- =============================================================================
-- Migration 010: RADIUS Test Seed Data
-- Run this ONCE after deploying migration 007 (vendor_abstraction).
-- Purpose: Create a verifiable test router + test user for RADIUS end-to-end check.
-- =============================================================================

-- =============================================================================
-- STEP 1: Insert the RADIUS test router
-- This represents a NAS device (MikroTik / Ruijie) that will point to our
-- Fly.io host for authentication.
--
-- Fields:
--   vendor         = 'radius'               → uses RADIUS driver
--   vendor_config  = {
--     "radius_secret": "testSecret123",     → shared secret (must match NAS config)
--     "nas_ip":        null                 → null = accept from ANY NAS IP (test mode)
--   }
--   ip_address     = 'fly-radius-test'      → placeholder; not used as a connect target
-- =============================================================================
INSERT INTO routers (
    id,
    tenant_id,
    name,
    location,
    ip_address,
    api_port,
    username_encrypted,
    password_encrypted,
    vendor,
    vendor_config,
    is_active
)
SELECT
    '00000000-aaaa-bbbb-cccc-000000000001'::UUID,
    t.id,                                           -- first tenant in the system
    'RADIUS Test NAS',
    'Test / Fly Deployment',
    'fly-radius-test',
    1812,
    'N/A',                                          -- no RouterOS API needed
    'N/A',
    'radius',
    '{"radius_secret": "testSecret123", "nas_ip": null}'::JSONB,
    true
FROM tenants t
ORDER BY t.created_at ASC
LIMIT 1
ON CONFLICT (id) DO UPDATE
    SET vendor_config = EXCLUDED.vendor_config,
        is_active     = true,
        updated_at    = NOW();

-- =============================================================================
-- STEP 2: Insert RADIUS test user
--
-- username:           testuser
-- plaintext password: TestPass99
-- status:             active  → should return Access-Accept
--
-- IMPORTANT: password_encrypted must be the AES-256-GCM encryption of
--            'TestPass99' using your production ENCRYPTION_KEY.
--
-- Run this in your backend to generate the value:
--   node -e "
--     const {encrypt} = require('./backend/src/utils/crypto');
--     console.log(encrypt('TestPass99'));
--   "
-- Then replace <<ENCRYPTED_PASSWORD_HERE>> below with the output.
-- =============================================================================
INSERT INTO radius_users (
    id,
    tenant_id,
    service_id,
    router_id,
    username,
    password_encrypted,
    rate_limit,
    session_timeout,
    status
)
SELECT
    '00000000-dddd-eeee-ffff-000000000002'::UUID,
    t.id,
    s.id,
    '00000000-aaaa-bbbb-cccc-000000000001'::UUID,
    'testuser',
    'f6be7c30564a95fa7fd10455:1d8ace61e1437e2a11f8c4c3db53ff49:fb6ca465e1cf1e9a7918',
    '10M/5M',                            -- Mikrotik-Rate-Limit returned on Accept
    86400,                               -- 24-hour session timeout
    'active'
FROM tenants t
JOIN services s ON s.tenant_id = t.id
ORDER BY t.created_at ASC, s.created_at ASC
LIMIT 1
ON CONFLICT (username) DO UPDATE
    SET status             = EXCLUDED.status,
        password_encrypted = EXCLUDED.password_encrypted,
        rate_limit         = EXCLUDED.rate_limit,
        updated_at         = NOW();

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after the migration to confirm the seed data exists:
-- =============================================================================
-- SELECT id, name, vendor, vendor_config, is_active FROM routers WHERE vendor='radius';
-- SELECT id, username, rate_limit, status FROM radius_users WHERE username='testuser';
