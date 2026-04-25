const supabase = require('../utils/supabase');
const mikrotikService = require('../services/mikrotikService');
const radiusServer = require('../services/radiusServer');

/**
 * GET /api/sessions/live
 * Aggregates live session data from RADIUS and all active MikroTik routers.
 */
exports.getLiveSessions = async (req, res) => {
    try {
        // 1. Fetch all routers for this tenant
        const { data: routers, error: rErr } = await supabase
            .from('routers')
            .select('*')
            .eq('tenant_id', req.tenant_id);

        if (rErr) throw rErr;

        const liveData = [];

        // 2. Fetch RADIUS sessions (In-memory)
        const radiusSessions = radiusServer.getActiveSessions();
        const tenantRadiusSessions = radiusSessions.filter(s => s.routerId !== 'unknown'); 
        // Note: In a multi-tenant setup, we should ensure radiusServer tracks tenant_id
        
        tenantRadiusSessions.forEach(s => {
            liveData.push({
                source: 'radius',
                username: s.username,
                ip: s.ip,
                mac: s.mac,
                uptime: s.uptime,
                download: (s.tx / (1024 * 1024)).toFixed(2) + ' MB',
                upload: (s.rx / (1024 * 1024)).toFixed(2) + ' MB',
                router_name: 'RADIUS Node',
                status: 'active'
            });
        });

        // 3. Fetch MikroTik sessions (Live API)
        const tikPromises = routers
            .filter(r => r.vendor === 'mikrotik')
            .map(async (r) => {
                try {
                    const sessions = await mikrotikService.getDetailedActiveSessions(req.tenant_id, r.id);
                    return sessions.map(s => ({
                        source: 'mikrotik',
                        username: s.username,
                        ip: s.address,
                        mac: s.caller_id || s.mac || 'N/A',
                        uptime: s.uptime,
                        download: s.bytes_out ? (s.bytes_out / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A',
                        upload: s.bytes_in ? (s.bytes_in / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A',
                        router_name: r.name,
                        router_id: r.id,
                        session_id: s.id,
                        service: s.service,
                        status: 'active'
                    }));
                } catch (e) {
                    console.error(`[Session Controller] Failed to fetch from ${r.name}:`, e.message);
                    return [];
                }
            });

        const tikResults = await Promise.all(tikPromises);
        tikResults.forEach(batch => liveData.push(...batch));

        return res.json({
            success: true,
            count: liveData.length,
            sessions: liveData
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

/**
 * POST /api/sessions/disconnect
 * Terminates a live session on the router.
 */
exports.disconnectSession = async (req, res) => {
    const { router_id, session_id, service, username } = req.body;

    if (!router_id || !session_id) {
        return res.status(400).json({ error: 'router_id and session_id are required' });
    }

    try {
        const { client } = await mikrotikService.connectToRouter(req.tenant_id, router_id);
        
        try {
            if (service === 'pppoe') {
                await client.menu('/ppp/active').remove(session_id);
            } else if (service === 'hotspot') {
                await client.menu('/ip/hotspot/active').remove(session_id);
            }
            
            await client.close();
            return res.json({ success: true, message: `Session for ${username} terminated.` });
        } catch (inner) {
            await client.close();
            throw inner;
        }
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
