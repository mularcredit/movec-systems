require('dotenv').config();
const supabase = require('./src/utils/supabase');
const mikrotikService = require('./src/services/mikrotikService');
const radiusServer = require('./src/services/radiusServer');

async function run() {
    const tenant_id = '05fc726c-a96b-4277-a255-72aea9889992';
    try {
        const { data: routers, error: rErr } = await supabase
            .from('routers')
            .select('*')
            .eq('tenant_id', tenant_id);

        if (rErr) throw rErr;

        const liveData = [];
        const radiusSessions = radiusServer.getActiveSessions();
        const radiusSessionMap = new Map();
        radiusSessions.forEach(s => radiusSessionMap.set(s.username, s));

        const tikPromises = routers
            .filter(r => r.username_encrypted && r.password_encrypted)
            .map(async (r) => {
                try {
                    const sessions = await mikrotikService.getDetailedActiveSessions(tenant_id, r.id);
                    return sessions.map(s => ({
                        username: s.username,
                        ip: s.address,
                        router_name: r.name,
                        router_id: r.id
                    }));
                } catch (e) {
                    console.error(`FAIL for ${r.name}:`, e.message);
                    return [];
                }
            });

        const tikResults = await Promise.all(tikPromises);
        const seenUsernames = new Set();

        tikResults.forEach(batch => {
            batch.forEach(apiSession => {
                seenUsernames.add(apiSession.username);
                liveData.push({
                    source: 'mikrotik',
                    username: apiSession.username,
                    ip: apiSession.ip,
                    router_name: apiSession.router_name
                });
            });
        });

        console.log(`Total Live Data Records: ${liveData.length}`);
        console.log('Live Session Users:', liveData.map(s => s.username));
    } catch (err) {
        console.error('Live sessions crash:', err);
    }
    process.exit(0);
}
run();
