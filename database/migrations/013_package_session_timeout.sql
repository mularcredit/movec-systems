-- Migration 013: Package Session Timeout
-- Adds session_timeout to packages and syncs it to radius_users via trigger.

-- 1. Add session_timeout to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS session_timeout INTEGER DEFAULT 86400;

COMMENT ON COLUMN packages.session_timeout IS 'RADIUS Session-Timeout attribute in seconds. Default 86400 (24 hours).';

-- 2. Create trigger function to sync session_timeout to radius_users
CREATE OR REPLACE FUNCTION sync_package_session_timeout()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync if session_timeout actually changed
    IF (OLD.session_timeout IS DISTINCT FROM NEW.session_timeout) THEN
        UPDATE radius_users
        SET session_timeout = NEW.session_timeout
        WHERE service_id IN (
            SELECT id FROM services WHERE package_id = NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to packages table
DROP TRIGGER IF EXISTS trg_sync_package_session_timeout ON packages;
CREATE TRIGGER trg_sync_package_session_timeout
    AFTER UPDATE ON packages
    FOR EACH ROW
    EXECUTE FUNCTION sync_package_session_timeout();
