require('dotenv').config();
const { RouterOSClient } = require('routeros-client');
const supabase = require('./src/utils/supabase');
const { decrypt } = require('./src/utils/crypto');

async function runTest() {
    console.log('\n======================================');
    console.log('   MIKROTIK API CONNECTION TESTER');
    console.log('======================================\n');

    console.log('[1/4] Fetching TULI ONE from database...');
    const { data: routers, error } = await supabase
        .from('routers')
        .select('*')
        .ilike('name', '%360%');

    if (error) {
        console.error('❌ Database error:', error.message);
        process.exit(1);
    }

    if (!routers || routers.length === 0) {
        console.error('❌ Router not found in database. Make sure the name contains "Tuli"');
        process.exit(1);
    }

    const r = routers[0];
    console.log(`✅ Found router: ${r.name}`);
    console.log(`   IP Address: ${r.ip_address}`);
    console.log(`   API Port:   ${r.api_port}`);

    console.log('\n[2/4] Checking credentials...');
    if (!r.username_encrypted || !r.password_encrypted) {
        console.error('❌ FAIL: No API credentials have been saved for this router.');
        console.log('   Please go to the Dashboard -> Edit Router and add the MikroTik Username & Password.');
        process.exit(1);
    }

    let user, pass;
    try {
        user = decrypt(r.username_encrypted);
        pass = decrypt(r.password_encrypted);
        console.log(`✅ Credentials decrypted successfully (Username: ${user})`);
    } catch (e) {
        console.error('❌ FAIL: Could not decrypt credentials.', e.message);
        process.exit(1);
    }

    console.log(`\n[3/4] Attempting to connect to ${r.ip_address}:${r.api_port || 8729}...`);
    const port = Number(r.api_port) || 8729;
    const isTls = port === 8729;

    const api = new RouterOSClient({
        host: r.ip_address,
        user: user,
        password: pass,
        port: port,
        tls: isTls,
        timeout: 5000 // 5 seconds
    });

    try {
        const client = await api.connect();
        console.log('✅ SUCCESS: Connected to RouterOS API!');
        
        console.log('\n[4/4] Testing data retrieval (CPU/RAM)...');
        const resources = await client.menu('/system/resource').get();
        console.log(`   RouterOS Version: ${resources[0].version}`);
        console.log(`   CPU Load:         ${resources[0]['cpu-load']}%`);
        console.log(`   Free Memory:      ${Math.floor(resources[0]['free-memory'] / 1024 / 1024)} MB`);
        
        await api.close();
        console.log('\n✅ All tests passed. The router is communicating perfectly.');
    } catch (e) {
        console.log('\n❌ CONNECTION FAILED');
        console.log('--------------------------------------');
        console.log('REASON:', e.message);
        console.log('--------------------------------------');
        console.log('\nTROUBLESHOOTING:');
        if (e.message.toLowerCase().includes('timeout')) {
            console.log('1. The router is unreachable at this IP.');
            console.log('2. The API port is blocked by the router firewall.');
            console.log('3. The WireGuard tunnel is down.');
            console.log('4. Look in Winbox -> IP -> Services -> api-ssl. Is "Available From" restricting IPs?');
        } else if (e.message.toLowerCase().includes('login') || e.message.toLowerCase().includes('password')) {
            console.log('1. The username or password you entered is incorrect.');
        } else if (e.message.toLowerCase().includes('econnrefused')) {
            console.log('1. The api-ssl service is DISABLED in Winbox (IP -> Services).');
            console.log('2. The port number is wrong.');
        }
    }
    process.exit(0);
}

runTest();
