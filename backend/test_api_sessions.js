require('dotenv').config();
const { RouterOSClient } = require('routeros-client');
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/crypto');

async function checkApiSessions() {
    const { data: routers } = await supabase.from('routers').select('*').or('name.ilike.%Tuli%,name.ilike.%360%');
    
    for (const r of routers) {
        if (!r.username_encrypted || !r.password_encrypted) continue;
        
        const user = decrypt(r.username_encrypted);
        const pass = decrypt(r.password_encrypted);
        
        console.log(`\nConnecting to ${r.name} API on port ${r.api_port || 8729}...`);
        const api = new RouterOSClient({
            host: r.ip_address,
            user: user,
            password: pass,
            port: Number(r.api_port) || 8729,
            tls: Number(r.api_port) === 8729,
            timeout: 5000
        });

        try {
            const client = await api.connect();
            const pppActive = await client.menu('/ppp/active').get();
            console.log(`✅ Found ${pppActive.length} active PPPoE tunnels on ${r.name}:`);
            pppActive.forEach(s => console.log(`   - User: ${s.name} | IP: ${s.address} | Uptime: ${s.uptime}`));
            await api.close();
        } catch (e) {
            console.log(`❌ Error querying ${r.name}: ${e.message}`);
        }
    }
    process.exit(0);
}
checkApiSessions();
