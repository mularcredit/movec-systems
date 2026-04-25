const supabase = require('../utils/supabase');
const mikrotikService = require('../services/mikrotikService');
const radiusServer = require('../services/radiusServer');

/**
 * GET /api/sessions/live
 * Aggregates live session data from RADIUS and all active MikroTik routers.
 * Two independent paths:
 *   Path A — MikroTik API (only routers with credentials)
 *   Path B — RADIUS Memory (ALL routers, credential-independent, always runs)
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
        
        const radiusSessionMap = new Map();
        tenantRadiusSessions.forEach(s => radiusSessionMap.set(s.username, s));

        // 3. Fetch MikroTik sessions (Live API) for ALL routers with credentials
        const tikPromises = routers
            .filter(r => r.username_encrypted && r.password_encrypted)
            .map(async (r) => {
                try {
                    const sessions = await mikrotikService.getDetailedActiveSessions(req.tenant_id, r.id);
                    return sessions.map(s => ({
                        username: s.username,
                        ip: s.address,
                        mac: s.caller_id || s.mac || 'N/A',
                        uptime: s.uptime,
                        download: s.bytes_out ? (s.bytes_out / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A',
                        upload: s.bytes_in ? (s.bytes_in / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A',
                        router_name: r.name,
                        router_id: r.id,
                        session_id: s.id,
                        service: s.service
                    }));
                } catch (e) {
                    console.error(`[Session Controller] Failed to fetch API sessions from ${r.name}:`, e.message);
                    return [];
                }
            });

        const tikResults = await Promise.all(tikPromises);
        const seenUsernames = new Set();

        tikResults.forEach(batch => {
            batch.forEach(apiSession => {
                seenUsernames.add(apiSession.username);
                const rSession = radiusSessionMap.get(apiSession.username);
                
                liveData.push({
                    source: rSession ? 'hybrid' : 'mikrotik',
                    username: apiSession.username,
                    ip: apiSession.ip,
                    mac: apiSession.mac,
                    uptime: apiSession.uptime,
                    download: rSession ? (rSession.tx / (1024 * 1024)).toFixed(2) + ' MB' : apiSession.download,
                    upload: rSession ? (rSession.rx / (1024 * 1024)).toFixed(2) + ' MB' : apiSession.upload,
                    router_name: apiSession.router_name,
                    router_id: apiSession.router_id,
                    session_id: apiSession.session_id,
                    service: apiSession.service,
                    status: 'active'
                });
            });
        });

        // PATH B: RADIUS memory sessions for ALL routers (credential-independent)
        // This ensures RADIUS-only routers that have no API credentials still appear in the Live Hub
        tenantRadiusSessions.forEach(s => {
            if (!seenUsernames.has(s.username)) {
                const router = routers.find(r => r.id === s.routerId);
                liveData.push({
                    source: 'radius',
                    username: s.username,
                    ip: s.ip,
                    mac: s.mac || 'N/A',
                    uptime: s.uptime,
                    download: (s.tx / (1024 * 1024)).toFixed(2) + ' MB',
                    upload: (s.rx / (1024 * 1024)).toFixed(2) + ' MB',
                    router_name: router ? router.name : 'RADIUS Node',
                    router_id: s.routerId || null,
                    status: 'active'
                });
            }
        });

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
