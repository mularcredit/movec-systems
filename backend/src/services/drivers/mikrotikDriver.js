const mikrotikService = require('../mikrotikService');

/**
 * MikroTik Driver — Adapter
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the existing mikrotikService.js into the unified 5-method vendor
 * interface. Zero changes to mikrotikService logic.
 * NOTE: Uses mikrotikService directly — NO import of mikrotikController
 *       to avoid circular dependencies (controller → factory → driver → controller).
 * ─────────────────────────────────────────────────────────────────────────────
 */

async function provisionService(tenant_id, router, service, pkg, plainPassword) {
    // Resolve the correct router profile name from the package
    const routerProfile = service.service_type === 'Hotspot'
        ? pkg.router_hotspot_profile
        : pkg.router_ppp_profile;

    if (!routerProfile) {
        throw new Error(`Router profile missing on package '${pkg.display_name}'. Set router_ppp_profile or router_hotspot_profile.`);
    }

    // mikrotikService.provisionUser expects a customer-shaped object
    const mappedCustomer = {
        ...service,
        full_name: service.persons?.full_name || service.full_name || 'Enterprise Service'
    };

    return await mikrotikService.provisionUser(
        tenant_id,
        router.id,
        mappedCustomer,
        service.service_type,
        routerProfile,
        plainPassword
    );
}

async function suspendService(tenant_id, router_id, username) {
    const { client } = await mikrotikService.withRetry(() =>
        mikrotikService.connectToRouter(tenant_id, router_id)
    );
    try {
        const secrets = await client.menu('/ppp/secret').get();
        const secret = secrets.find(s => s.name === username);
        if (!secret) throw new Error(`PPP secret '${username}' not found on this router.`);
        await client.menu('/ppp/secret').update({ disabled: 'yes' }, secret['.id']);
        // Kill the live session if active
        try {
            const active = await client.menu('/ppp/active').get();
            const session = active.find(s => s.name === username);
            if (session) await client.menu('/ppp/active').remove([session['.id']]);
        } catch (_) { /* no active session — acceptable */ }
        return true;
    } finally {
        await client.close().catch(() => {});
    }
}

async function restoreService(tenant_id, router_id, username) {
    const { client } = await mikrotikService.withRetry(() =>
        mikrotikService.connectToRouter(tenant_id, router_id)
    );
    try {
        const secrets = await client.menu('/ppp/secret').get();
        const secret = secrets.find(s => s.name === username);
        if (!secret) throw new Error(`PPP secret '${username}' not found on this router.`);
        await client.menu('/ppp/secret').update({ disabled: 'no' }, secret['.id']);
        return true;
    } finally {
        await client.close().catch(() => {});
    }
}

async function updatePassword(tenant_id, router_id, service_type, username, plainPassword, encryptedPassword) {
    return await mikrotikService.updateUserPassword(tenant_id, router_id, service_type, username, plainPassword);
}

async function testConnection(router) {
    const { client } = await mikrotikService.withRetry(() =>
        mikrotikService.connectToRouter(router.tenant_id || router.id, router.id)
    );
    const identity = await client.menu('/system/identity').get();
    await client.close().catch(() => {});
    return { success: true, identity: identity[0]?.name, mode: 'mikrotik' };
}

module.exports = {
    provisionService,
    suspendService,
    restoreService,
    updatePassword,
    testConnection
};
