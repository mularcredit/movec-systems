/**
 * NetworkVendorService — Factory & Dispatcher
 * ─────────────────────────────────────────────────────────────────────────────
 * The ONLY entry point for all vendor-network operations.
 * Controllers should NEVER call mikrotikService or radiusDriver directly.
 *
 * Usage:
 *   const nvs = require('./networkVendorService');
 *   const driver = nvs.getDriver(router.vendor);
 *   await driver.provisionService(tenant_id, router, service, pkg, password);
 *
 * Vendor values (from routers.vendor column):
 *   'mikrotik' → MikroTik RouterOS API (direct socket)
 *   'radius'   → Generic RADIUS NAS client (Ruijie, Huawei, TP-Link, etc.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mikrotikDriver = require('./drivers/mikrotikDriver');
const radiusDriver   = require('./drivers/radiusDriver');

const DRIVERS = {
    mikrotik: mikrotikDriver,
    radius:   radiusDriver
};

/**
 * Returns the correct driver instance for the given vendor string.
 * Throws clearly if the vendor is unknown — fail-fast is intentional.
 *
 * @param {string} vendor - 'mikrotik' | 'radius'
 * @returns {object} Driver with: provisionService, suspendService, restoreService, updatePassword, testConnection
 */
function getDriver(vendor) {
    const driver = DRIVERS[vendor];
    if (!driver) {
        throw new Error(
            `[NetworkVendorService] Unknown vendor '${vendor}'. ` +
            `Supported vendors: ${Object.keys(DRIVERS).join(', ')}.`
        );
    }
    return driver;
}

/**
 * Convenience: resolve vendor from a router object and return the driver.
 * Defaults to 'mikrotik' if vendor is not set (backward-compatible).
 *
 * @param {object} router - Router record from Supabase (must include .vendor)
 */
function getDriverForRouter(router) {
    return getDriver(router.vendor || 'mikrotik');
}

module.exports = { getDriver, getDriverForRouter };
