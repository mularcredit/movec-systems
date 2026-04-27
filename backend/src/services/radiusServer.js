/**
 * RADIUS AAA Server — In-Process UDP Server
 * ─────────────────────────────────────────────────────────────────────────────
 */

const dgram   = require('dgram');
const radius  = require('radius');
const supabase = require('../utils/supabase');
const { decrypt } = require('../utils/crypto');

// =============================================================================
// IN-MEMORY SESSION TRACKER (Live Telemetry)
// =============================================================================
const activeSessions = new Map();

function trackSession(packet, rinfo, router) {
    const username = packet.attributes['User-Name'];
    const status = packet.attributes['Acct-Status-Type'];
    const sessionId = packet.attributes['Acct-Session-Id'];

    if (!username || !sessionId) return;

    if (status === 'Start' || status === 'Interim-Update') {
        activeSessions.set(sessionId, {
            username,
            sessionId,
            nasIp: rinfo.address,
            ip: packet.attributes['Framed-IP-Address'] || 'N/A',
            mac: packet.attributes['Calling-Station-Id'] || 'N/A',
            uptime: packet.attributes['Acct-Session-Time'] || 0,
            tx: packet.attributes['Acct-Output-Octets'] || 0,
            rx: packet.attributes['Acct-Input-Octets'] || 0,
            lastUpdate: Date.now(),
            routerId: router?.id || 'unknown',
            service: packet.attributes['Service-Type'] === 'Framed-User' ? 'PPPoE' : (packet.attributes['Service-Type'] || 'PPPoE')
        });
    } else if (status === 'Stop') {
        activeSessions.delete(sessionId);
    }
}

// Clean up stale sessions (older than 10 mins without update)
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of activeSessions.entries()) {
        if (now - session.lastUpdate > 10 * 60 * 1000) {
            activeSessions.delete(id);
        }
    }
}, 60000);

// =============================================================================
// SHARED SECRET RESOLVER
// =============================================================================
async function resolveSecret(nasIp) {
    try {
        const { data: routers } = await supabase
            .from('routers')
            .select('id, tenant_id, vendor, ip_address, vendor_config');

        if (routers) {
            // PASS 1: Try exact NAS-IP match first (most specific wins)
            for (const r of routers) {
                const config = r.vendor_config || {};
                const configuredNasIp = config.nas_ip || r.ip_address || null;
                
                if (configuredNasIp && configuredNasIp === nasIp) {
                    const secret = config.radius_secret || process.env.RADIUS_DEFAULT_SECRET;
                    console.log(`[RADIUS] Exact NAS-IP match: ${nasIp} → router ${r.id}`);
                    return { secret, router: r };
                }
            }

            // PASS 2: Fall back to wildcard entries (no nas_ip configured)
            for (const r of routers) {
                const config = r.vendor_config || {};
                if (r.vendor === 'radius' && !config.nas_ip && config.radius_secret) {
                    console.log(`[RADIUS] Wildcard match for ${nasIp} → router ${r.id}`);
                    return { secret: config.radius_secret, router: r };
                }
            }
        }

        const fallback = process.env.RADIUS_DEFAULT_SECRET;
        if (fallback) {
            console.log(`[RADIUS] Using env fallback secret for ${nasIp}`);
            return { secret: fallback, router: null };
        }

        console.warn(`[RADIUS] No matching secret found for NAS ${nasIp} — packet DISCARDED`);
        return null;
    } catch (e) {
        console.error('[RADIUS] Secret resolution error:', e.message);
        return null;
    }
}

// =============================================================================
// AUTHENTICATION HANDLER
// =============================================================================
async function handleAccessRequest(packet, rinfo, socket, secret, router) {
    const username  = packet.attributes['User-Name'];
    const userPass  = packet.attributes['User-Password']; 

    if (!username) {
        console.warn(`[RADIUS] Received Access-Request without User-Name from ${rinfo.address}`);
        return;
    }

    try {
        let query = supabase
            .from('radius_users')
            .select('username, password_encrypted, rate_limit, framed_ip_address, session_timeout, status')
            .eq('username', username)
            .limit(1);

        if (router) query = query.eq('tenant_id', router.tenant_id);

        const { data: users, error } = await query;
        if (error) throw error;

        const user = (users && users.length > 0) ? users[0] : null;

        if (!user || user.status !== 'active') {
            const rejectPacket = radius.encode_response({
                packet,
                code: 'Access-Reject',
                secret,
                add_message_authenticator: true,
                attributes: [
                    ['Reply-Message', user ? 'Account Suspended' : 'User Not Found']
                ]
            });
            socket.send(rejectPacket, rinfo.port, rinfo.address);
            console.log(`[RADIUS] Access-Reject → ${username} (${user ? 'suspended' : 'not found'}) from ${rinfo.address}`);
            return;
        }

        const storedPassword = decrypt(user.password_encrypted);

        // --- AUTHENTICATION LOGIC (PAP vs CHAP) ---
        let isAuthenticated = false;

        if (packet.attributes['User-Password']) {
            // PAP Authentication
            isAuthenticated = (storedPassword === userPass);
        } else if (packet.attributes['CHAP-Password']) {
            // CHAP Authentication (RFC 1994 / 2865)
            const chapPass = packet.attributes['CHAP-Password'];
            // CHAP-Password is: 1 byte (ID) + 16 bytes (MD5 Hash)
            const chapId = chapPass[0];
            const chapHash = chapPass.slice(1);

            // Challenge is usually in CHAP-Challenge attribute, 
            // fallback to the Request Authenticator
            const challenge = packet.attributes['CHAP-Challenge'] || packet.authenticator;

            // MD5(ID + Password + Challenge)
            const crypto = require('crypto');
            const expectedHash = crypto.createHash('md5')
                .update(Buffer.from([chapId]))
                .update(storedPassword)
                .update(challenge)
                .digest();

            isAuthenticated = crypto.timingSafeEqual(chapHash, expectedHash);
        }

        if (!isAuthenticated) {
            const rejectPacket = radius.encode_response({
                packet,
                code: 'Access-Reject',
                secret,
                add_message_authenticator: true,
                attributes: [['Reply-Message', 'Invalid credentials']]
            });
            socket.send(rejectPacket, rinfo.port, rinfo.address);
            console.log(`[RADIUS] Access-Reject → ${username} (auth failed) from ${rinfo.address}`);
            return;
        }

        const acceptAttrs = [];

        // 1. Session-Timeout (Standard Attribute 27)
        const timeout = parseInt(user.session_timeout) || 86400;
        acceptAttrs.push(['Session-Timeout', timeout]);

        // 2. MikroTik Rate Limit (VSA 14988, Type 8)
        if (user.rate_limit) {
            try {
                // Correctly wrapping the rate limit in a Buffer as required by the library
                const rateLimitBuffer = Buffer.from(user.rate_limit);
                acceptAttrs.push([
                    'Vendor-Specific',
                    14988, 
                    [[8, rateLimitBuffer]] 
                ]);
            } catch (err) {
                console.warn(`[RADIUS] Could not encode Rate-Limit: ${err.message}`);
            }
        }

        // 3. Framed-IP-Address (Standard Attribute 8)
        if (user.framed_ip_address && user.framed_ip_address.includes('.')) {
            acceptAttrs.push(['Framed-IP-Address', user.framed_ip_address]);
        }

        // 4. DNS Servers (Microsoft VSAs 311 - 27 & 28)
        // Pushing Google DNS for instant internet connectivity
        try {
            acceptAttrs.push([
                'Vendor-Specific',
                311, 
                [
                    [27, Buffer.from([8, 8, 8, 8])], // MS-Primary-DNS-Server
                    [28, Buffer.from([8, 8, 4, 4])]  // MS-Secondary-DNS-Server
                ]
            ]);
        } catch (err) {
            console.warn(`[RADIUS] Could not encode DNS attributes: ${err.message}`);
        }

        const acceptPacket = radius.encode_response({
            packet,
            code: 'Access-Accept',
            secret,
            add_message_authenticator: true,
            attributes: acceptAttrs
        });

        socket.send(acceptPacket, rinfo.port, rinfo.address);
        console.log(`[RADIUS] Access-Accept → ${username} (Rate: ${user.rate_limit || 'unlimited'}) from ${rinfo.address}`);

    } catch (e) {
        console.error(`[RADIUS] Auth error for ${username}:`, e.message);
        try {
            const rejectPacket = radius.encode_response({
                packet, code: 'Access-Reject', secret,
                add_message_authenticator: true,
                attributes: [['Reply-Message', 'Authentication service error']]
            });
            socket.send(rejectPacket, rinfo.port, rinfo.address);
        } catch (_) {}
    }
}

// =============================================================================
// SERVER START
// =============================================================================
function createListener(port, typeLabel) {
    const socket = dgram.createSocket('udp4');

    socket.on('message', async (msg, rinfo) => {
        // HYPER-VERBOSE DEBUG LOGGING FOR TROUBLESHOOTING
        console.log(`\n[RADIUS RAW PACKET] >>> Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port} on ${typeLabel}`);
        console.log(`[RADIUS RAW HEX] ${msg.toString('hex').match(/.{1,2}/g).join(' ')}`);
        
        try {
            const resolved = await resolveSecret(rinfo.address);
            if (!resolved) {
                console.warn(`[RADIUS] Packet from unknown NAS ${rinfo.address} — no matching secret. DISCARDED.`);
                return;
            }

            const { secret, router } = resolved;
            let packet;
            try {
                packet = radius.decode({ packet: msg, secret });
            } catch (decodeErr) {
                console.warn(`[RADIUS] Failed to decode packet from ${rinfo.address}: ${decodeErr.message}`);
                return;
            }

            const username = packet.attributes['User-Name'] || 'unknown';

            if (packet.code === 'Access-Request') {
                await handleAccessRequest(packet, rinfo, socket, secret, router);
            } else if (packet.code === 'Accounting-Request') {
                trackSession(packet, rinfo, router);
                const response = radius.encode_response({
                    packet,
                    code: 'Accounting-Response',
                    secret
                });
                socket.send(response, rinfo.port, rinfo.address);
                console.log(`[RADIUS] Accounting-${packet.attributes['Acct-Status-Type']} → ${username} from ${rinfo.address}`);
            }

        } catch (e) {
            console.error(`[RADIUS] Error on port ${port}:`, e.message);
        }
    });

    socket.on('error', (err) => {
        console.error(`[RADIUS] ${typeLabel} Socket error on port ${port}:`, err.message);
    });

    socket.bind(port, '0.0.0.0', () => {
        console.log(`[RADIUS ${typeLabel}] Listening on UDP 0.0.0.0:${port}`);
    });

    return socket;
}

function start() {
    try {
        const authPort = parseInt(process.env.RADIUS_AUTH_PORT) || 1812;
        const acctPort = parseInt(process.env.RADIUS_ACCT_PORT) || 1813;
        const diagPort = 11812; // Forced diagnostic port
        
        createListener(authPort, 'Auth');
        createListener(acctPort, 'Acct');
        createListener(diagPort, 'Diag');
        
        console.log(`[RADIUS] Production listeners active on ports ${authPort}, ${acctPort}, and ${diagPort}`);
    } catch (e) {
        console.error('[RADIUS] CRITICAL STARTUP ERROR:', e);
    }
}

module.exports = { 
    start,
    getActiveSessions: () => Array.from(activeSessions.values())
};
