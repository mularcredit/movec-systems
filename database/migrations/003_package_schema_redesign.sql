-- =============================================================================
-- Migration 003: Package Schema Redesign
-- Run in Supabase SQL Editor ONCE before deploying the updated backend/frontend.
-- Safe to run on live data — all steps are non-destructive.
-- =============================================================================

-- BACKUP CONFIRMATION:
-- Before running: SELECT COUNT(*) FROM packages; 
-- After running:  SELECT id, display_name, service_type, router_ppp_profile, router_hotspot_profile FROM packages;

-- =============================================================================
-- STEP 1: Rename name → display_name
-- =============================================================================
ALTER TABLE packages RENAME COLUMN name TO display_name;

-- =============================================================================
-- STEP 2: Add the two router profile columns
-- =============================================================================
ALTER TABLE packages
    ADD COLUMN IF NOT EXISTS router_ppp_profile     TEXT,
    ADD COLUMN IF NOT EXISTS router_hotspot_profile TEXT;

-- =============================================================================
-- STEP 3: Backfill profile columns from old display_name values
-- This preserves existing provisioning behavior for all live packages.
-- After migration, operators should update each package's profile columns
-- to match the exact RouterOS profile name if they differ from display_name.
-- =============================================================================
UPDATE packages
    SET router_ppp_profile = display_name
    WHERE service_type IN ('PPPoE', 'Static')
      AND router_ppp_profile IS NULL;

UPDATE packages
    SET router_hotspot_profile = display_name
    WHERE service_type = 'Hotspot'
      AND router_hotspot_profile IS NULL;

-- =============================================================================
-- STEP 4: Add UNIQUE constraint on display_name
-- =============================================================================
ALTER TABLE packages
    ADD CONSTRAINT packages_display_name_unique UNIQUE (display_name);

-- =============================================================================
-- STEP 5: Deprecate burst_config
-- Column is retained to avoid data loss. UI no longer exposes it.
-- Implement as RouterOS queue rules in a future phase.
-- =============================================================================
COMMENT ON COLUMN packages.burst_config IS
    'DEPRECATED as of migration 003. Stored but never applied to RouterOS. '
    'Implement via /queue/simple or /queue/tree in a future release.';

-- =============================================================================
-- STEP 6: Update RLS — add INSERT/UPDATE policies for authenticated staff
-- (Previously only SELECT was defined)
-- =============================================================================
DROP POLICY IF EXISTS "Staff manages packages" ON packages;
CREATE POLICY "Staff manages packages"
    ON packages FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- =============================================================================
-- VERIFICATION QUERIES (run after migration to confirm success)
-- =============================================================================
-- SELECT id, display_name, service_type, router_ppp_profile, router_hotspot_profile FROM packages;
-- SELECT conname FROM pg_constraint WHERE conname = 'packages_display_name_unique';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'packages';

-- =============================================================================
-- ROLLBACK (if needed — run in reverse order)
-- =============================================================================
-- ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_display_name_unique;
-- ALTER TABLE packages DROP COLUMN IF EXISTS router_ppp_profile;
-- ALTER TABLE packages DROP COLUMN IF EXISTS router_hotspot_profile;
-- ALTER TABLE packages RENAME COLUMN display_name TO name;
