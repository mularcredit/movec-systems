-- Migration: M-Pesa STK Request Tracking
-- Tracking table for mapping CheckoutRequestID to Account Numbers

CREATE TABLE IF NOT EXISTS mpesa_stk_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkout_request_id TEXT UNIQUE NOT NULL,
    merchant_request_id TEXT,
    tenant_id UUID NOT NULL,
    account_number TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | success | failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup on callback
CREATE INDEX IF NOT EXISTS idx_stk_checkout_id ON mpesa_stk_requests(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_stk_account_num ON mpesa_stk_requests(account_number);

COMMENT ON TABLE mpesa_stk_requests IS 'Maps Safaricom CheckoutRequestIDs to internal accounts before the IPN arrives.';
