-- Migration: Add Carry Forward tracking for overpayments
-- Tracks excess credit that can be applied to future billing cycles

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS carry_forward NUMERIC(15,2) DEFAULT 0;

-- Optional: Index for reporting
CREATE INDEX IF NOT EXISTS idx_services_carry_forward ON services(carry_forward) WHERE carry_forward > 0;

COMMENT ON COLUMN services.carry_forward IS 'Tracks excess payments (credit) to be applied to future cycles.';
