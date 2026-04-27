require('dotenv').config();
const { RouterOSClient } = require('routeros-client');
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/crypto');

async function runTest() {
    console.log('\n======================================');
    console.log('   MIKROTIK LIVE SUBSCRIBERS INSPECTOR');
    console.log('======================================\n');

    const { data: routers } = await supabase.from('routers').select('*').ilike('name', '%Tuli%');
    if (!routers || routers.length === 0) process.exit(1);
    const r = routers[0];

    const user = decrypt(r.username_encrypted);
    const pass = decrypt(r.password_encrypted);

    const api = new RouterOSClient({
        host: r.ip_address,
        user: user,
        password: pass,
        port: Number(r.api_port) || 8728,
        tls: Number(r.api_port) === 8729,
        timeout: 5000
    });

    try {
        const client = await api.connect();
        console.log('✅ Connected.');

        const active = await client.menu('/ppp/active').get();
        const secrets = await client.menu('/ppp/secret').get();

        console.log('\n--- ACTIVE PPPoE SESSIONS ---');
        console.log(`Count: ${active.length}`);
        active.forEach(a => console.log(`- User: ${a.name} | IP: ${a.address} | Uptime: ${a.uptime}`));

        console.log('\n--- PPPoE SECRETS (ACCOUNTS) ---');
        console.log(`Count: ${secrets.length}`);
        secrets.forEach(s => console.log(`- User: ${s.name} | Profile: ${s.profile} | Disabled: ${s.disabled}`));

        await api.close();
    } catch (e) {
        console.error('❌ FAILED:', e.message);
    }
    process.exit(0);
}
runTest();
