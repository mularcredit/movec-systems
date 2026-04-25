const supabase = require('../utils/supabase');
const { encrypt, decrypt } = require('../utils/crypto');
const { RouterOSClient } = require('routeros-client');
const mikrotikService = require('../services/mikrotikService');
const networkVendorService = require('../services/networkVendorService');
const radiusService = require('../services/radiusServer');

// Convenience alias — enforces API-SSL policy automatically inside connectToRouter
const getConnectedClient = async (tenant_id, router_id) => {
    return await mikrotikService.connectToRouter(tenant_id, router_id);
};

// ---------------------------------------------------------
// ONBOARDING & ARCHITECTURE ENDPOINTS
// ---------------------------------------------------------

exports.testConnection = async (req, res) => {
    const { ip, port, username, password } = req.body;
    const resolvedPort = parseInt(port) || 8729;
    try {
        // Enforce API-SSL policy before attempting any connection
        mikrotikService.enforceApiSslPolicy(resolvedPort, `${ip}:${resolvedPort}`);

        const api = new RouterOSClient({
            host:     ip,
            user:     username,
            password: password,
            port:     resolvedPort,
            tls:      resolvedPort === 8729,
            timeout:  5000
        });
        const client = await api.connect();

        const identity = await client.menu('/system/identity').get();
        const profiles = await client.menu('/ppp/profile').get().catch(() => []);
        const hotspotProfiles = await client.menu('/ip/hotspot/user/profile').get().catch(() => []);

        await api.close();

        return res.json({
            success:          true,
            message:          'Handshake verified.',
            identity:         identity[0]?.name,
            ppp_profiles:     profiles.map(p => p.name),
            hotspot_profiles: hotspotProfiles.map(p => p.name),
            tls_active:       resolvedPort === 8729
        });
    } catch (error) {
        const isSecurityError = error.message?.includes('SECURITY POLICY VIOLATION');
        return res.status(isSecurityError ? 403 : 500).json({
            error:   isSecurityError ? 'API-SSL Required' : 'Failed to connect to the RouterOS device.',
            details: error.message
        });
    }
};

exports.linkRouter = async (req, res) => {
    const { name, ip, port, username, password, conn_type, tunnel_ip, endpoint_host, endpoint_port, server_public_key, vendor, vendor_config } = req.body;
    const resolvedVendor = vendor || 'mikrotik';
    const resolvedPort   = parseInt(port) || 8729;

    try {
        let osVersion = 'N/A';
        let connStatus = 'online';

        if (resolvedVendor === 'mikrotik') {
            // MikroTik: enforce API-SSL and run live handshake probe
            mikrotikService.enforceApiSslPolicy(resolvedPort, `${name || ip}:${resolvedPort}`);

            const api = new RouterOSClient({
                host:     ip,
                user:     username,
                password: password,
                port:     resolvedPort,
                tls:      resolvedPort === 8729,
                timeout:  5000
            });
            const client = await api.connect();
            const osResp = await client.menu('/system/resource').get();
            await api.close();
            osVersion = osResp[0]?.version || 'Unknown';
        } else {
            // RADIUS / Generic: no live probe — router delegates auth externally
            // Connection status starts as 'pending' until an Access-Request is seen
            connStatus = 'pending';
        }

        const encryptedPassword = username && password ? encrypt(password) : null;
        const encryptedUsername = username ? encrypt(username) : null;

        const insertPayload = {
            name,
            ip_address:         ip,
            api_port:           resolvedPort,
            username_encrypted: encryptedUsername,
            password_encrypted: encryptedPassword,
            conn_type:          conn_type || 'direct',
            tunnel_ip, endpoint_host, endpoint_port, server_public_key,
            router_os_version:  osVersion,
            connection_status:  connStatus,
            sync_status:        resolvedVendor === 'mikrotik' ? 'synced' : 'n/a',
            last_seen_at:       new Date().toISOString(),
            vendor:             resolvedVendor,
            vendor_config:      vendor_config || null,
            tenant_id:          req.tenant_id
        };

        const { data, error } = await supabase.from('routers').insert([insertPayload]).select().single();
        if (error) {
            console.error('[DATABASE ERROR] Router link failed:', error.message, error.details);
            throw error;
        }

        console.log(`[SUCCESS] Router '${name}' linked. Vendor: ${resolvedVendor}`);
        res.json({ success: true, router: data });
    } catch (error) {
        const isSecurityError = error.message?.includes('SECURITY POLICY VIOLATION');
        res.status(isSecurityError ? 403 : 500).json({
            error:   isSecurityError ? 'API-SSL Required — router not saved' : 'Link procedure failed',
            details: error.message
        });
    }
};

exports.syncRouter = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        await client.close();
        res.json({ success: true, message: 'Sync sequence achieved.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ── Profile Readiness Check ───────────────────────────────────────────────────
// Called by the UI before creating a package or during router detail view.
// Returns all PPP and Hotspot profiles currently on the router, and validates
// whether a specific profile name exists — preventing avoidable provision failures.
exports.getRouterProfiles = async (req, res) => {
    const { profile_name } = req.query; // optional — if provided, validates existence
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const pppProfiles     = await client.menu('/ppp/profile').get().catch(() => []);
        const hotspotProfiles = await client.menu('/ip/hotspot/user/profile').get().catch(() => []);
        await client.close();

        const pppNames     = pppProfiles.map(p => p.name);
        const hotspotNames = hotspotProfiles.map(p => p.name);

        const response = {
            success:          true,
            ppp_profiles:     pppNames,
            hotspot_profiles: hotspotNames
        };

        if (profile_name) {
            response.profile_check = {
                requested:  profile_name,
                pppoe_ok:   pppNames.includes(profile_name),
                hotspot_ok: hotspotNames.includes(profile_name),
                warning:    (!pppNames.includes(profile_name) && !hotspotNames.includes(profile_name))
                    ? `Profile '${profile_name}' not found. Create it on the router before provisioning.`
                    : null
            };
        }

        res.json(response);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ---------------------------------------------------------
// COMPREHENSIVE DATA ENDPOINTS
// ---------------------------------------------------------

exports.getAllRouters = async (req, res) => {
    try {
        const { data, error } = await supabase.from('routers')
            .select('id, name, location, ip_address, api_port, router_os_version, total_users, connection_status, sync_status, last_seen_at, conn_type, vendor')
            .eq('tenant_id', req.tenant_id);
        if (error) throw error;
        res.json({ success: true, routers: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getRouterDetails = async (req, res) => {
    try {
        const { data, error } = await supabase.from('routers').select('*').eq('tenant_id', req.tenant_id).eq('id', req.params.router_id).single();
        if (error) throw error;
        // Don't send encrypted blobs to frontend
        delete data.username_encrypted; delete data.password_encrypted;
        res.json({ success: true, router: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deleteRouter = async (req, res) => {
    try {
        const { router_id } = req.params;
        const { error } = await supabase
            .from('routers')
            .delete()
            .eq('id', router_id)
            .eq('tenant_id', req.tenant_id);

        if (error) throw error;
        res.json({ success: true, message: 'Router successfully decommissioned.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.updateRouter = async (req, res) => {
    try {
        const { router_id } = req.params;
        const updates = req.body;
        
        // Ensure no cross-tenant modification
        const { data: existing, error: existErr } = await supabase
            .from('routers')
            .select('*')
            .eq('id', router_id)
            .eq('tenant_id', req.tenant_id)
            .single();
            
        if (existErr || !existing) throw new Error('Router not found or unauthorized');

        const dbPayload = {
            name: updates.name || existing.name,
            ip_address: updates.ip_address || existing.ip_address,
            api_port: updates.api_port || existing.api_port,
            location: updates.location !== undefined ? updates.location : existing.location,
            vendor: updates.vendor || existing.vendor,
            conn_type: updates.conn_type || existing.conn_type,
            vendor_config: updates.vendor_config || existing.vendor_config,
        };

        // Optionally update credentials only if provided
        if (updates.username && updates.password) {
            dbPayload.username_encrypted = encrypt(updates.username);
            dbPayload.password_encrypted = encrypt(updates.password);
        }

        const { data: updated, error } = await supabase
            .from('routers')
            .update(dbPayload)
            .eq('id', router_id)
            .eq('tenant_id', req.tenant_id)
            .select()
            .single();

        if (error) throw error;
        
        delete updated.username_encrypted;
        delete updated.password_encrypted;
        
        res.json({ success: true, router: updated });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// --- MikroTik Live Polling Handlers ---

exports.getInterfaces = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const interfaces = await client.menu('/interface').get();
        await client.close();
        res.json({ success: true, count: interfaces.length, data: interfaces });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getHotspotProfiles = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const profiles = await client.menu('/ip/hotspot/profile').get();
        const active = await client.menu('/ip/hotspot/active').get();
        await client.close();
        res.json({ success: true, profiles, active_sessions: active });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getPppoeProfiles = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const secrets = await client.menu('/ppp/secret').get();
        const active = await client.menu('/ppp/active').get();
        await client.close();
        res.json({ success: true, accounts: secrets, active_sessions: active });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getDhcpLeases = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const leases = await client.menu('/ip/dhcp-server/lease').get();
        await client.close();
        res.json({ success: true, leases });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getFirewallRules = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const filter = await client.menu('/ip/firewall/filter').get();
        const nat = await client.menu('/ip/firewall/nat').get();
        await client.close();
        res.json({ success: true, rules: { filter, nat } });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getWirelessRegistrations = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const wlan = await client.menu('/interface/wireless/registration-table').get();
        await client.close();
        res.json({ success: true, clients: wlan });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getRouterHealthStats = async (req, res) => {
    try {
        const data = await mikrotikService.getRouterDashboardData(req.tenant_id, req.params.router_id);
        res.json({ success: true, ...data });
    } catch (e) { 
        res.status(500).json({ error: e.message }); 
    }
};

exports.getScriptsAndSchedulers = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        const scripts = await client.menu('/system/script').get().catch(() => ([]));
        const schedulers = await client.menu('/system/scheduler').get().catch(() => ([]));
        await client.close();
        res.json({ success: true, scripts, schedulers });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getLiveTrafficMonitor = async (req, res) => {
    try {
        const { client } = await getConnectedClient(req.tenant_id, req.params.router_id);
        // Execute a synchronous one-time traffic monitor on all active interfaces
        const traffic = await client.menu('/interface/monitor-traffic').get({ interface: 'all', once: 'true' }).catch(() => ([]));
        await client.close();
        res.json({ success: true, traffic });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// ---------------------------------------------------------
// SESSION CONTROL & CUSTOMER LIFECYCLE
// ---------------------------------------------------------

// Exported internal function for Workers & Triggers
exports.internalSuspendAccount = async (tenant_id, router_id, username) => {
    // Resolve vendor to decide which driver to use
    const { data: router } = await supabase.from('routers').select('vendor, vendor_config, ip_address').eq('id', router_id).single();
    const vendor = router?.vendor || 'mikrotik';

    const driver = networkVendorService.getDriver(vendor);
    return await driver.suspendService(tenant_id, router_id, username);
};

exports.internalReconnectAccount = async (tenant_id, router_id, username) => {
    const { data: router } = await supabase.from('routers').select('vendor, vendor_config, ip_address').eq('id', router_id).single();
    const vendor = router?.vendor || 'mikrotik';

    const driver = networkVendorService.getDriver(vendor);
    return await driver.restoreService(tenant_id, router_id, username);
};

exports.suspendPppSecret = async (req, res) => {
    const { router_id, username } = req.params;
    try {
        await exports.internalSuspendAccount(req.tenant_id, router_id, username);
        res.json({ success: true, message: `Account '${username}' suspended and disconnected.` });
    } catch (e) { res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message }); }
};

exports.reconnectPppSecret = async (req, res) => {
    const { router_id, username } = req.params;
    try {
        await exports.internalReconnectAccount(req.tenant_id, router_id, username);
        res.json({ success: true, message: `Account '${username}' re-enabled. Customer can now authenticate.` });
    } catch (e) { res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message }); }
};

exports.killPppoeSession = async (req, res) => {
    const { router_id, session_id } = req.params;
    try {
        const { client } = await getConnectedClient(req.tenant_id, router_id);
        await client.menu('/ppp/active').remove([session_id]);
        await client.close();
        res.json({ success: true, message: 'PPPoE session terminated.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.killHotspotSession = async (req, res) => {
    const { router_id, session_id } = req.params;
    try {
        const { client } = await getConnectedClient(req.tenant_id, router_id);
        await client.menu('/ip/hotspot/active').remove([session_id]);
        await client.close();
        res.json({ success: true, message: 'Hotspot session terminated.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getAllActiveSessions = async (req, res) => {
    try {
        const { data: routers, error } = await supabase
            .from('routers')
            .select('id, name, connection_status, vendor')
            .eq('tenant_id', req.tenant_id);
        
        if (error) throw error;

        const allSessions = [];
        
        // 1. Fetch MikroTik API sessions
        const mkPromises = routers
            .filter(r => r.vendor === 'mikrotik' && r.connection_status === 'online')
            .map(async (router) => {
                try {
                    const data = await mikrotikService.getDetailedActiveSessions(req.tenant_id, router.id);
                    return data.map(s => ({ ...s, router_name: router.name, router_id: router.id }));
                } catch (err) {
                    console.error(`Failed to fetch sessions for ${router.name}:`, err.message);
                    return [];
                }
            });

        const mkResults = await Promise.all(mkPromises);
        mkResults.forEach(batch => allSessions.push(...batch));

        // 2. Fetch RADIUS in-memory sessions
        const radiusSessions = radiusService.getActiveSessions();
        radiusSessions.forEach(s => {
            const r = routers.find(router => router.id === s.routerId);
            if (r) {
                allSessions.push({
                    id: s.sessionId,
                    subscriber: s.username,
                    service: s.service,
                    ip: s.ip,
                    mac: s.mac,
                    uptime: s.uptime,
                    router_name: r.name,
                    router_id: r.id,
                    status: 'online'
                });
            }
        });

        res.json({ success: true, count: allSessions.length, sessions: allSessions });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.getGlobalNetworkOverview = async (req, res) => {
    try {
        const { data: routers, error } = await supabase
            .from('routers')
            .select('id, name, connection_status, vendor')
            .eq('tenant_id', req.tenant_id);
        
        if (error) throw error;

        const overview = {
            total_routers: routers.length,
            online_routers: 0,
            offline_routers: 0,
            total_active_sessions: 0,
            total_tx_bps: 0,
            total_rx_bps: 0,
            router_metrics: []
        };

        const promises = routers.map(async (router) => {
            let apiData = null;
            let radiusSessions = [];
            
            // 1. Always check RADIUS in-memory sessions if it's a RADIUS vendor
            if (router.vendor === 'radius') {
                radiusSessions = radiusService.getActiveSessions().filter(s => s.routerId === router.id);
            }

            // 2. Attempt API Handshake if we have credentials (Hybrid Mode)
            // Note: Even RADIUS vendors might have credentials for status polling
            const hasCredentials = router.username_encrypted && router.password_encrypted;
            
            if (hasCredentials && (router.connection_status === 'online' || router.vendor === 'radius')) {
                try {
                    const [dash, traffic] = await Promise.all([
                        mikrotikService.getRouterDashboardData(req.tenant_id, router.id),
                        mikrotikService.getInterfaceTraffic(req.tenant_id, router.id)
                    ]);
                    
                    const router_tx = traffic.reduce((s, i) => s + Number(i.tx_bits_per_second || 0), 0);
                    const router_rx = traffic.reduce((s, i) => s + Number(i.rx_bits_per_second || 0), 0);

                    apiData = {
                        status: 'online',
                        cpu_load: dash.resources['cpu-load'],
                        free_memory: dash.resources['free-memory'],
                        uptime: dash.resources.uptime,
                        active_sessions: dash.totalActive,
                        tx_bps: router_tx,
                        rx_bps: router_rx,
                        health: dash.health,
                        os_version: dash.resources.version
                    };

                    overview.total_tx_bps += router_tx;
                    overview.total_rx_bps += router_rx;
                    overview.total_active_sessions += dash.totalActive;
                } catch (err) {
                    console.warn(`[Network Overview] API unreachable for ${router.name}:`, err.message);
                }
            }

            // 3. Final Status Aggregation
            const isApiOnline = apiData?.status === 'online';
            const isRadiusActive = radiusSessions.length > 0;

            if (isApiOnline) {
                overview.online_routers++;
                return {
                    id: router.id,
                    name: router.name,
                    vendor: router.vendor,
                    ...apiData,
                    // If it's a RADIUS vendor, we might want to show both counts or prioritize one
                    active_sessions: router.vendor === 'radius' ? radiusSessions.length : apiData.active_sessions
                };
            } else if (isRadiusActive) {
                // "Ghost" Online: API is down but clients are flowing via RADIUS
                overview.online_routers++;
                overview.total_active_sessions += radiusSessions.length;
                return {
                    id: router.id,
                    name: router.name,
                    vendor: router.vendor,
                    status: 'warning',
                    active_sessions: radiusSessions.length,
                    cpu_load: 0,
                    uptime: 'API Unreachable',
                    tx_bps: 0, rx_bps: 0
                };
            } else {
                overview.offline_routers++;
                return {
                    id: router.id,
                    name: router.name,
                    vendor: router.vendor,
                    status: router.vendor === 'radius' ? 'pending' : 'offline',
                    active_sessions: 0,
                    cpu_load: 0,
                    uptime: 'Offline'
                };
            }
        });

        overview.router_metrics = await Promise.all(promises);
        res.json({ success: true, overview });
    } catch (e) { res.status(500).json({ error: e.message }); }
};
