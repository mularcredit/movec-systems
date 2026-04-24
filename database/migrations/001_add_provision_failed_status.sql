-- =============================================================================
-- Migration: Add 'provision_failed' to customer_status enum
-- Run this in your Supabase SQL Editor ONCE before deploying the updated backend.
-- =============================================================================

-- PostgreSQL does not support removing values from an enum, but adding is safe.
-- This adds 'provision_failed' as a distinct state that means:
--   "The customer record was created in the DB, but MikroTik provisioning failed."
-- It is semantically separate from 'suspended' (billing-driven disconnection).

ALTER TYPE customer_status ADD VALUE IF NOT EXISTS 'provision_failed';

-- Verify the new enum values:
-- SELECT unnest(enum_range(NULL::customer_status));

-- Add RLS policy for provision_logs (missing from original schema)
ALTER TABLE provision_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages provision logs"
    ON provision_logs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated staff can view provision logs"
    ON provision_logs FOR SELECT
    USING (auth.role() = 'authenticated');
