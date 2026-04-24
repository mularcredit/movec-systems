-- Migration 011: Make Router Credentials Optional
-- Radius/Generic routers do not require backend credentials (IP/API)
-- as they authenticate toward the platform via RADIUS UDP.

ALTER TABLE routers 
  ALTER COLUMN username_encrypted DROP NOT NULL,
  ALTER COLUMN password_encrypted DROP NOT NULL;

COMMENT ON COLUMN routers.username_encrypted IS 'Encrypted API username. Nullable for RADIUS/Generic vendors.';
COMMENT ON COLUMN routers.password_encrypted IS 'Encrypted API password. Nullable for RADIUS/Generic vendors.';
