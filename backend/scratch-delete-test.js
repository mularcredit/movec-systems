require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
async function test() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    // Let's check the schema of `persons` and `services`
    const { data: persons } = await supabase.from('persons').select('*').limit(1);
    console.log("PERSONS SCHEMA:", Object.keys(persons[0]));
}
test();
