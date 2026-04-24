const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const tenant_id = '05fc726c-a96b-4277-a255-72aea9889992';

async function check() {
    console.log('Checking settings for tenant:', tenant_id);
    const { data, error } = await supabase.from('app_settings').select('key, value').eq('tenant_id', tenant_id);
    if (error) console.error(error);
    else console.log('Keys found:', data.map(d => d.key));
}

check();
