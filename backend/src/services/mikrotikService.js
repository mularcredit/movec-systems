const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/crypto');
const { RouterOSClient } = require('routeros-client');

// =============================================================================
// SECURITY POLICY: API-SSL ENFORCEMENT
// =============================================================================
// In production, plaintext RouterOS API (port 8728) is BLOCKED by default.
// To explicitly permit it (e.g. behind an isolated management VLAN), set:
//   ALLOW_INSECURE_MIKROTIK_API=true   in your backend .env
//
// This check is called by connectToRouter() and must also be called by
// mikrotikController.testConnection() / linkRouter() before any connection.
// =============================================================================

/**
 * Enforces API-SSL policy. Throws a security error if:
 *   - NODE_ENV === 'production' AND
 *   - port !== 8729 AND
 *   - ALLOW_INSECURE_MIKROTIK_API !== 'true'
 *
 * @param {number} port
 * @param {string} routerLabel  - human-readable identifier for the error message
 */
function enforceApiSslPolicy(port, routerLabel = 'router') {
    const isProduction = process.env.NODE_ENV === 'production';
    const isPlaintext  = Number(port) !== 8729;
    const overrideSet  = process.env.ALLOW_INSECURE_MIKROTIK_API === 'true';

    if (isProduction && isPlaintext) {
        if (overrideSet) {
            // Override acknowledged — warn loudly but allow
            console.warn(
                `[MikroTik Service] ⚠️  SECURITY OVERRIDE ACTIVE: Connecting to ${routerLabel} ` +
                `on plaintext port ${port} in production. ` +
                `ALLOW_INSECURE_MIKROTIK_API=true is set. ` +
                `This exposes credentials on the network. Remove this override in production.`
            );
        } else {
            // Hard block — throw before any connection attempt
            throw new Error(
                `SECURITY POLICY VIOLATION: Plaintext RouterOS API (port ${port}) is not permitted in production. ` +
                `Use port 8729 (API-SSL). ` +
                `If you require plaintext access (e.g. isolated VLAN), set ALLOW_INSECURE_MIKROTIK_API=true in your .env and restart the server.`
            );
        }
    }
}

// =============================================================================
// PROVISION LOGGING
// =============================================================================

/**
 * Writes a provisioning attempt record to provision_logs.
 * Never throws — logging must not abort the main flow.
 */
async function logProvisioning(tenant_id, customer_id, router_id, action, status, message) {
    try {
        await supabase.from('provision_logs').insert([{
            tenant_id,
            customer_id,
            router_id,
            action,
            status,
            message: message || null
        }]);
    } catch (e) {
        console.error('[MikroTik Service] Failed to write provision log:', e.message);
    }
}

// =============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// =============================================================================

/**
 * Retries an async function up to maxRetries times.
 * Delay doubles after each failure (1.5s → 3s → 6s by default).
 */
async function withRetry(fn, maxRetries = 3, delayMs = 1500) {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (err) {
            attempt++;
            if (attempt >= maxRetries) throw err;
            console.warn(`[MikroTik Service] Attempt ${attempt} failed. Retrying in ${delayMs}ms... (${err.message})`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2;
        }
    }
}

// =============================================================================
// PRE-PROVISIONING VALIDATION
// =============================================================================

/**
 * Validates all inputs required for provisioning.
 * Throws descriptive errors that are safe to surface to the caller.
 * No network calls made here — pure local validation + DB lookup.
 */
async function provisionPreCheck(tenant_id, router_id, customer, service_type, package_name, password) {
    if (!router_id) throw new Error('Pre-check failed: router_id is required.');

    const { data: router, error: routerErr } = await supabase
        .from('routers')
        .select('id, name, ip_address, api_port, username_encrypted, password_encrypted')
        .eq('tenant_id', tenant_id)
        .eq('id', router_id)
        .single();

    if (routerErr || !router) throw new Error('Pre-check failed: Router not found in database.');

    try {
        decrypt(router.username_encrypted);
        decrypt(router.password_encrypted);
    } catch (_) {
        throw new Error(
            'Pre-check failed: Router credentials cannot be decrypted. ' +
            'The ENCRYPTION_KEY may have changed since this router was saved. ' +
            'Re-add the router to regenerate encrypted credentials.'
        );
    }

    const validTypes = ['PPPOE', 'HOTSPOT'];
    if (!validTypes.includes(service_type.toUpperCase())) {
        throw new Error(`Pre-check failed: Unknown service_type '${service_type}'. Expected one of: ${validTypes.join(', ')}`);
    }

    if (!customer.username || !customer.username.trim()) {
        throw new Error('Pre-check failed: customer.username is required for provisioning.');
    }

    if (!password || !password.trim()) {
        throw new Error('Pre-check failed: password is required for provisioning.');
    }

    if (!package_name || !package_name.trim()) {
        throw new Error('Pre-check failed: package_name is required and must match a RouterOS profile.');
    }

    return router;
}

// =============================================================================
// ROUTER CONNECTION
// =============================================================================

/**
 * Opens an authenticated RouterOS API connection.
 * Enforces API-SSL policy before attempting any network connection.
 *
 * Port 8729 → TLS (API-SSL) — required in production
 * Port 8728 → plaintext    — blocked in production unless override is set
 *
 * @param {string} router_id
 * @returns {{ client: RouterOSClient, router: object }}
 */
async function connectToRouter(tenant_id, router_id) {
    const { data: router, error } = await supabase
        .from('routers')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('id', router_id)
        .single();

    if (error || !router) throw new Error('Router DB Entity Not Found');

    let username, password;
    try {
        username = decrypt(router.username_encrypted);
        password = decrypt(router.password_encrypted);
    } catch (e) {
        throw new Error(
            'Failed to decrypt router credentials. ' +
            'If ENCRYPTION_KEY was rotated since this router was saved, re-add the router.'
        );
    }

    const port   = Number(router.api_port) || 8729;
    const useTls = port === 8729;

    // Enforce API-SSL policy — throws in prod without override
    enforceApiSslPolicy(port, `'${router.name}' (${router.ip_address})`);

    const api = new RouterOSClient({
        host:     router.ip_address,
        user:     username,
        password: password,
        port:     port,
        tls:      useTls,
        timeout:  10000
    });

    const session = await api.connect();
    // Attach close method so callers can safely use client.menu() and client.close()
    session.close = () => api.close();

    // POLYFILL/SAFETY: Patch .menu() to include a hard timeout
    // node-routeros has a bug where it throws an unhandled exception on `!empty` and leaves
    // the Promise hanging indefinitely because it never emits '!done' or '!trap'.
    const originalMenu = session.menu.bind(session);
    session.menu = (menuString) => {
        const menuObj = originalMenu(menuString);
        const originalGet = menuObj.get.bind(menuObj);
        menuObj.get = (...args) => {
            return Promise.race([
                originalGet(...args),
                new Promise((_, reject) => setTimeout(() => {
                    api.close(); // Forcefully destroy the hung socket
                    reject(new Error('Router Timeout: The MikroTik device stopped responding to the query.'));
                }, 8000))
            ]);
        };
        return menuObj;
    };

    return { client: session, router };
}

// =============================================================================
// PROFILE VALIDATION HELPERS
// =============================================================================

async function validatePppProfile(client, profileName) {
    let profiles;
    try {
        profiles = await client.menu('/ppp/profile').get();
    } catch (e) {
        throw new Error(`Profile validation failed: Could not fetch /ppp/profile from router. ${e.message}`);
    }

    const names = profiles.map(p => p.name);
    if (!names.includes(profileName)) {
        throw new Error(
            `PPP profile '${profileName}' does NOT exist on this router. ` +
            `Available profiles: [${names.join(', ')}]. ` +
            `Create the profile on the router before provisioning.`
        );
    }
}

async function validateHotspotProfile(client, profileName) {
    let profiles;
    try {
        profiles = await client.menu('/ip/hotspot/user/profile').get();
    } catch (e) {
        throw new Error(`Profile validation failed: Could not fetch /ip/hotspot/user/profile from router. ${e.message}`);
    }

    const names = profiles.map(p => p.name);
    if (!names.includes(profileName)) {
        throw new Error(
            `Hotspot user profile '${profileName}' does NOT exist on this router. ` +
            `Available profiles: [${names.join(', ')}]. ` +
            `Create the profile on the router before provisioning.`
        );
    }
}

// =============================================================================
// PROVISIONING ORCHESTRATOR
// =============================================================================

/**
 * Full provisioning pipeline:
 *   1. Pre-check all inputs (fail fast, no network calls yet)
 *   2. Connect to router with retry + exponential backoff
 *   3. Validate RouterOS profile exists on the live router
 *   4. Add or update the user (idempotent)
 *   5. Log result to provision_logs
 *
 * CONTRACT — package_name:
 *   This parameter MUST be the DB-resolved RouterOS profile name, read from
 *   packages.router_ppp_profile (for PPPoE) or packages.router_hotspot_profile
 *   (for Hotspot) by the caller (customerController.js).
 *   It must NEVER be taken from frontend input or from packages.display_name.
 *   The frontend sends package_id only; profile resolution is the backend's
 *   responsibility exclusively.
 *
 * @param {string} tenant_id
 * @param {string} router_id
 * @param {object} customer
 * @param {string} service_type    - 'PPPoE' | 'Hotspot'
 * @param {string} package_name    - DB-resolved RouterOS profile name (see CONTRACT above)
 * @param {string} password        - plaintext, in-memory only, never stored
 */
async function provisionUser(tenant_id, router_id, customer, service_type, package_name, password) {
    await provisionPreCheck(tenant_id, router_id, customer, service_type, package_name, password);

    let client;
    try {
        const { client: connectedClient } = await withRetry(() => connectToRouter(tenant_id, router_id));
        client = connectedClient;

        let successMessage = '';

        if (service_type.toUpperCase() === 'PPPOE') {
            await validatePppProfile(client, package_name);
            successMessage = await provisionPppoeUser(client, customer, package_name, password);
        } else if (service_type.toUpperCase() === 'HOTSPOT') {
            await validateHotspotProfile(client, package_name);
            successMessage = await provisionHotspotUser(client, customer, package_name, password);
        } else {
            successMessage = `Service type '${service_type}' is manual/static — no RouterOS action taken.`;
        }

        await client.close();

        await logProvisioning(
            tenant_id, customer.id, router_id,
            `PROVISION_${service_type.toUpperCase()}`,
            'success', successMessage
        );

        return { success: true, message: successMessage };

    } catch (error) {
        if (client) await client.close().catch(() => {});

        const errorMsg = error.message.includes('timeout')
            ? 'Router connection timed out after 10 seconds'
            : error.message;

        await logProvisioning(
            tenant_id, customer.id, router_id,
            `PROVISION_${service_type.toUpperCase()}`,
            'failed', errorMsg
        );

        throw new Error(`MikroTik Provisioning Failed: ${errorMsg}`);
    }
}

// =============================================================================
// PPPoE PROVISIONING (idempotent)
// =============================================================================

async function provisionPppoeUser(client, customer, package_name, password) {
    const secrets  = await client.menu('/ppp/secret').get();
    const existing = secrets.find(s => s.name === customer.username);

    const payload = {
        name:    customer.username,
        password: password,
        profile: package_name,
        service: 'pppoe',
        comment: `MovecConnect: ${customer.account_number} - ${customer.full_name}`
    };

    if (customer.ip_address && customer.ip_address.trim() !== '') {
        payload['remote-address'] = customer.ip_address;
    }

    if (existing) {
        await client.menu('/ppp/secret').update(payload, existing['.id']);
        return `Successfully updated PPPoE secret for '${customer.username}' (Profile: ${package_name})`;
    } else {
        await client.menu('/ppp/secret').add(payload);
        return `Successfully provisioned new PPPoE secret for '${customer.username}' (Profile: ${package_name})`;
    }
}

// =============================================================================
// HOTSPOT PROVISIONING (idempotent)
// =============================================================================

async function provisionHotspotUser(client, customer, package_name, password) {
    const users    = await client.menu('/ip/hotspot/user').get();
    const existing = users.find(u => u.name === customer.username);

    const payload = {
        name:    customer.username,
        password: password,
        profile: package_name,
        server:  'all',
        comment: `MovecConnect: ${customer.account_number} - ${customer.full_name}`
    };

    if (customer.ip_address && customer.ip_address.trim() !== '') {
        payload.address = customer.ip_address;
    }

    if (existing) {
        await client.menu('/ip/hotspot/user').update(payload, existing['.id']);
        return `Successfully updated Hotspot user '${customer.username}' (Profile: ${package_name})`;
    } else {
        await client.menu('/ip/hotspot/user').add(payload);
        return `Successfully provisioned new Hotspot user '${customer.username}' (Profile: ${package_name})`;
    }
}

// =============================================================================
// UTILITY ENDPOINTS (PASSWORD EDIT & LOGS)
// =============================================================================

async function updateUserPassword(tenant_id, router_id, service_type, username, new_password) {
    const { client } = await withRetry(() => connectToRouter(tenant_id, router_id));
    try {
        if (service_type.toUpperCase() === 'PPPOE') {
            const secrets = await client.menu('/ppp/secret').get();
            const existing = secrets.find(s => s.name === username);
            if (existing) {
                await client.menu('/ppp/secret').update({ password: new_password }, existing['.id']);
                return true;
            }
        } else if (service_type.toUpperCase() === 'HOTSPOT') {
            const users = await client.menu('/ip/hotspot/user').get();
            const existing = users.find(u => u.name === username);
            if (existing) {
                await client.menu('/ip/hotspot/user').update({ password: new_password }, existing['.id']);
                return true;
            }
        }
        throw new Error(`MikroTik user ${username} not found on the router.`);
    } finally {
        await client.close().catch(() => {});
    }
}

async function getUserLogs(tenant_id, router_id, username) {
    const { client } = await withRetry(() => connectToRouter(tenant_id, router_id));
    try {
        const logs = await client.menu('/log').get();
        // MikroTik generic logs are returned chronologically. We filter by username and reverse them for UI display (newest first).
        const match = username.toLowerCase();
        const userLogs = logs.filter(l => l.message && l.message.toLowerCase().includes(match)).slice(-50).reverse();
        return userLogs;
    } finally {
        await client.close().catch(() => {});
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    connectToRouter,
    provisionUser,
    provisionPreCheck,
    withRetry,
    logProvisioning,
    enforceApiSslPolicy,
    updateUserPassword,
    getUserLogs
};
