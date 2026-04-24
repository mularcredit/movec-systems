-- Migration: Payment Category Tracking on Services
-- Run in Supabase SQL Editor

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS payment_category TEXT DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due      NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_date DATE;

-- Index for fast overdue queries
CREATE INDEX IF NOT EXISTS idx_services_balance_due_date
  ON services(balance_due_date)
  WHERE balance_due > 0;

-- Comment for clarity
COMMENT ON COLUMN services.payment_category IS
  'One of: full | partial | discounted | already_paid';
COMMENT ON COLUMN services.balance_due IS
  'Remaining balance owed at time of onboarding (for partial/discounted payments)';
COMMENT ON COLUMN services.balance_due_date IS
  'Deadline by which balance_due must be cleared; triggers suspension if overdue';
