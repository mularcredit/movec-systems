require('dotenv').config();
const supabase = require('./src/utils/supabase');
const mikrotikService = require('./src/services/mikrotikService');
const radiusService = require('./src/services/radiusServer');

async function run() {
    const { data: routers } = await supabase.from('routers').select('*').ilike('name', '%Tuli%');
    const router = routers[0];

    try {
        console.log('Fetching detailed API sessions for router:', router.name);
        const apiData = await mikrotikService.getDetailedActiveSessions('05fc726c-a96b-4277-a255-72aea9889992', router.id);
        console.log(`API Sessions Count: ${apiData.length}`);
        apiData.forEach(s => console.log(`- User: ${s.username} | IP: ${s.address}`));
    } catch (e) {
        console.error('Error fetching API sessions:', e.message);
    }
    process.exit(0);
}
run();
