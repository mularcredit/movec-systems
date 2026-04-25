require('dotenv').config();
const { RouterOSClient } = require('routeros-client');
const { decrypt } = require('./src/utils/crypto');
const supabase = require('./src/utils/supabase');

async function test() {
    try {
        console.log('Fetching router details...');
        const { data: routers } = await supabase.from('routers').select('*');
        if (!routers || routers.length === 0) {
            console.log('No routers found in DB.');
            return;
        }

        for (const router of routers) {
            console.log(`Testing Router: ${router.name} (${router.ip_address}:${router.api_port})`);
            try {
                const user = decrypt(router.username_encrypted);
                const pass = decrypt(router.password_encrypted);
                console.log(`Credentials decrypted for ${user}`);

                const api = new RouterOSClient({
                    host: router.ip_address,
                    user: user,
                    password: pass,
                    port: Number(router.api_port) || 8729,
                    tls: Number(router.api_port) === 8729,
                    timeout: 5000
                });

                console.log('Connecting...');
                const session = await api.connect();
                console.log('Connected! Fetching identity...');
                const id = await session.menu('/system/identity').get();
                console.log('Identity:', id);
                await api.close();
                console.log('Success.');
            } catch (err) {
                console.error(`Failed for ${router.name}:`, err.message);
            }
        }
    } catch (e) {
        console.error('Test script failed:', e.message);
    }
}

test();
