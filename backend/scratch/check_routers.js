const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkRouters() {
  const { data, error } = await supabase.from('routers').select('*');
  if (error) {
    console.error('Error fetching routers:', error);
    return;
  }
  console.log('Routers in DB:', JSON.stringify(data, null, 2));
}

checkRouters();
