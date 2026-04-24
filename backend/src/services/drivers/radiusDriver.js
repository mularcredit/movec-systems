const supabase = require('../../utils/supabase');
const { decrypt } = require('../../utils/crypto');

/**
 * RADIUS Driver
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles provisioning, suspension, and restoration for RADIUS-mode routers.
 * 
 * In this model:
 *   - The router (Ruijie, TP-Link, Huawei, etc.) is configured as a RADIUS NAS.
 *   - The NAS points to THIS backend server at UDP 1812 for authentication.
 *   - All business logic lives here; the router only enforces the RADIUS response.
 *
 * Source of truth: radius_users table in Supabase.
 *
 * Authentication protocol: PAP (passwords decrypted at request time).
 * ─────────────────────────────────────────────────────────────────────────────
 */

// =============================================================================
// PROVISION: Write a new user to the RADIUS user store
// =============================================================================
async function provisionService(tenant_id, router, service, pkg, plainPassword) {
    // Build the rate_limit attribute from package fields
    const rateLimit = pkg.radius_rate_limit
        || (pkg.speed_down_mbps && pkg.speed_up_mbps
            ? `${pkg.speed_down_mbps}M/${pkg.speed_up_mbps}M`
            : null);

    const { data: existing } = await supabase
        .from('radius_users')
        .select('id')
        .eq('username', service.username)
        .limit(1);

    const payload = {
        tenant_id,
        service_id:         service.id,
        router_id:          router.id,
        username:           service.username,
        password_encrypted: service.password_encrypted,
        rate_limit:         rateLimit,
        status:             'active'
    };

    if (existing?.[0]) {
        // Idempotent update — re-provision replaces the record
        const { error } = await supabase
            .from('radius_users')
            .update(payload)
            .eq('username', service.username);
        if (error) throw new Error(`RADIUS user update failed: ${error.message}`);
        return `RADIUS: Updated existing user '${service.username}' (Rate: ${rateLimit || 'unlimited'})`;
    } else {
        const { error } = await supabase
            .from('radius_users')
            .insert([payload]);
        if (error) throw new Error(`RADIUS user creation failed: ${error.message}`);
        return `RADIUS: Provisioned new user '${service.username}' (Rate: ${rateLimit || 'unlimited'})`;
    }
}

// =============================================================================
// SUSPEND: Mark user inactive → RADIUS server will return Access-Reject
// =============================================================================
async function suspendService(tenant_id, router_id, username) {
    const { error } = await supabase
        .from('radius_users')
        .update({ status: 'suspended' })
        .eq('username', username)
        .eq('tenant_id', tenant_id);

    if (error) throw new Error(`RADIUS suspend failed for '${username}': ${error.message}`);

    // Attempt CoA/Disconnect Message to terminate live session
    // This is best-effort — silently swallowed if NAS doesn't support CoA
    await sendDisconnectRequest(tenant_id, router_id, username);

    return true;
}

// =============================================================================
// RESTORE: Re-enable user → RADIUS server returns Access-Accept again
// =============================================================================
async function restoreService(tenant_id, router_id, username) {
    const { error } = await supabase
        .from('radius_users')
        .update({ status: 'active' })
        .eq('username', username)
        .eq('tenant_id', tenant_id);

    if (error) throw new Error(`RADIUS restore failed for '${username}': ${error.message}`);
    return true;
}

// =============================================================================
// UPDATE PASSWORD: Re-encrypt and update the stored credential
// =============================================================================
async function updatePassword(tenant_id, router_id, service_type, username, plainPassword, encryptedPassword) {
    const { error } = await supabase
        .from('radius_users')
        .update({ password_encrypted: encryptedPassword })
        .eq('username', username)
        .eq('tenant_id', tenant_id);

    if (error) throw new Error(`RADIUS password update failed: ${error.message}`);
    return true;
}

// =============================================================================
// TEST CONNECTION: Verify our RADIUS server sees the NAS shared secret
// For RADIUS mode, "connection test" = can we resolve the router's NAS IP
// and is the shared secret stored correctly.
// =============================================================================
async function testConnection(router) {
    const config = router.vendor_config || {};
    const nasIp = config.nas_ip || router.ip_address;
    const secret = config.radius_secret;

    if (!nasIp) throw new Error('NAS IP address not configured on this router record.');
    if (!secret) throw new Error('RADIUS shared secret (vendor_config.radius_secret) not configured.');

    // Lightweight ping-style check: attempt DNS resolution / reachability
    // We don't open a RADIUS session for test — just validate config is present.
    return {
        success: true,
        message: `RADIUS config validated for NAS ${nasIp}. Shared secret present (${secret.length} chars). Ensure the NAS is pointed to this server's IP on UDP 1812.`,
        nas_ip: nasIp,
        mode: 'radius'
    };
}

// =============================================================================
// INTERNAL: Send RADIUS Disconnect-Request (CoA/DM) to terminate live session
// Best-effort — many NAS devices do not support this.
// Silently fails if NAS does not respond or does not support CoA.
// =============================================================================
async function sendDisconnectRequest(tenant_id, router_id, username) {
    try {
        const { data: router } = await supabase
            .from('routers')
            .select('ip_address, vendor_config')
            .eq('id', router_id)
            .single();

        if (!router) return;
        const config = router.vendor_config || {};
        const nasIp = config.nas_ip || router.ip_address;
        const secret = config.radius_secret;
        if (!nasIp || !secret) return;

        const radiusPkg = require('radius');
        const dgram  = require('dgram');

        const packet = radiusPkg.encode({
            code: 'Disconnect-Request',
            secret,
            attributes: [
                ['User-Name', username]
            ]
        });

        const socket = dgram.createSocket('udp4');
        socket.send(packet, 0, packet.length, 3799, nasIp, () => {
            socket.close();
        });

        console.log(`[RADIUS Driver] Sent Disconnect-Request to NAS ${nasIp} for user '${username}'`);
    } catch (e) {
        // CoA is always best-effort. Log warn, never throw.
        console.warn(`[RADIUS Driver] CoA/DM failed for '${username}': ${e.message}`);
    }
}

module.exports = {
    provisionService,
    suspendService,
    restoreService,
    updatePassword,
    testConnection
};
