-- Migration: Track Carry Forward on individual payments
-- Allows the ledger to show if a specific payment resulted in an overpayment credit

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS carry_forward_applied NUMERIC(15,2) DEFAULT 0;

COMMENT ON COLUMN payments.carry_forward_applied IS 'Records how much of this specific payment was carried forward as credit.';
