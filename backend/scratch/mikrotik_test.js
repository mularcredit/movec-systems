require('dotenv').config({ path: '../.env' });
const { RouterOSClient } = require('routeros-client');
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: routers, error } = await supabase.from('routers').select('*').limit(1);
    if (!routers || routers.length === 0) return console.log('No routers');
    
    const router = routers[0];
    const { decryptSymmetric } = require('../src/utils/encryption');
    const pwd = decryptSymmetric(router.password_encrypted);
    
    console.log(`Connecting to ${router.ip_address}...`);
    const api = new RouterOSClient({
        host: router.ip_address,
        user: decryptSymmetric(router.username_encrypted),
        password: pwd,
        port: router.api_port,
        tls: router.api_port === 8729,
        timeout: 5000 // 5 sec timeout
    });
    
    try {
        const session = await api.connect();
        console.log('Connected! Fetching interfaces...');
        const ifaces = await session.menu('/interface').get();
        console.log(`Got ${ifaces.length} interfaces`);
        
        console.log('Fetching wireless...');
        const wlan = await session.menu('/interface/wireless/registration-table').get();
        console.log(`Got ${wlan.length} wireless clients`);
        
        api.close();
        console.log('Done!');
    } catch (e) {
        console.error('ERROR:', e.message);
        api.close();
    }
}
test();
