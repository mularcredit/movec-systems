require('dotenv').config({ path: '.env' });
const mikrotikService = require('./src/services/mikrotikService');
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: routers } = await supabase.from('routers').select('*').limit(1);
    
    if (routers && routers[0]) {
        console.log('[*] Connecting to router:', routers[0].name);
        const { client } = await mikrotikService.connectToRouter(routers[0].tenant_id, routers[0].id);
        
        console.log('[*] Fetching /log/print...');
        const logs = await client.menu('/log').get();
        console.log('Total Logs:', logs.length);
        
        const ianLogs = logs.filter(l => l.message && l.message.toLowerCase().includes('ian'));
        console.log('IAN LOGS:', ianLogs.slice(-5));
        
        process.exit();
    }
}
test();
