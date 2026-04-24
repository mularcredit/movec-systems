require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const mikrotikService = require('./src/services/mikrotikService');
const { decrypt } = require('./src/utils/crypto'); // FIXED IMPORT

async function test() {
    console.log('[*] Connecting to Supabase...');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    const { data: service, error: sErr } = await supabase.from('services')
        .select('*, persons(full_name), packages(*), routers(*)')
        .eq('status', 'provision_failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
    if (sErr || !service) {
        console.log('[-] No failed service found! Error:', sErr);
        return;
    }
    
    console.log(`[*] Target Router: ${service.routers.name} (${service.routers.ip_address})`);
    
    const mappedProfile = {
        ...service,
        full_name: service.persons.full_name
    };
    
    const routerProfile = service.service_type === 'Hotspot' 
        ? service.packages.router_hotspot_profile 
        : service.packages.router_ppp_profile;
        
    console.log(`[*] Using Mikrotik Profile: ${routerProfile}`);
    
    const rawPass = service.password_encrypted ? decrypt(service.password_encrypted) : 'password123';
    
    try {
        console.log('[!] STARTING PROVISION CALL...');
        const result = await mikrotikService.provisionUser(
            service.tenant_id,
            service.routers.id,
            mappedProfile,
            service.service_type,
            routerProfile,
            rawPass
        );
        console.log('[+] PROVISION SUCCESS! Result:', result);
    } catch (e) {
        console.log('--------------------------------------------------');
        console.log('[-] PROVISION FAILED WITH ERROR:');
        console.log(e.message);
        console.log('--------------------------------------------------');
    }
    process.exit();
}
test();
