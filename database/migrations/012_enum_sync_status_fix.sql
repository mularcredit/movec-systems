-- Migration 012: Add 'n/a' to router_sync_status enum
-- Required for RADIUS/Generic routers where background sync is not applicable.

ALTER TYPE router_sync_status ADD VALUE IF NOT EXISTS 'n/a';
