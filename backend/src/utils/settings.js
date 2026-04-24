const supabase = require('./supabase');
const { encrypt, decrypt } = require('./crypto');

// In-Memory Cache per tenant
let settingsCache = {}; // { tenant_id: cache_object }
let cacheTimestamps = {}; // { tenant_id: timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const SENSITIVE_KEYS = [
    'mpesa_consumer_secret',
    'mpesa_passkey',
    'celcom_api_key',
    'whatsapp_token'
];

async function fetchSettingsFromDB(tenant_id) {
    console.log(`[Settings] Fetching DB settings for tenant: ${tenant_id}`);
    const { data, error } = await supabase.from('app_settings').select('key, value').eq('tenant_id', tenant_id);
    if (error) {
        console.error('[Settings] DB Fetch Error:', error.message);
        return {};
    }
    
    const settings = {};
    for (const row of data) {
        if (SENSITIVE_KEYS.includes(row.key)) {
            try {
                settings[row.key] = decrypt(row.value);
            } catch (e) {
                console.error(`[Settings] CRITICAL Decryption failure for ${row.key}:`, e.message);
                settings[row.key] = row.value;
            }
        } else {
            settings[row.key] = row.value;
        }
    }
    return settings;
}

/**
 * Get all settings for a tenant (utilizes cache)
 */
async function getAllSettings(tenant_id) {
    if (!tenant_id) throw new Error('Settings lookup requires a tenant_id');
    const now = Date.now();
    if (settingsCache[tenant_id] && (now - (cacheTimestamps[tenant_id] || 0) < CACHE_TTL)) {
        return settingsCache[tenant_id];
    }
    settingsCache[tenant_id] = await fetchSettingsFromDB(tenant_id);
    cacheTimestamps[tenant_id] = now;
    return settingsCache[tenant_id];
}

/**
 * Retrieve a specific setting key dynamically
 */
async function getSetting(tenant_id, key) {
    const settings = await getAllSettings(tenant_id);
    return settings[key] || null;
}

/**
 * Upsert an array of settings { key, value }
 * Automatically encrypts sensitive keys before storage
 */
async function upsertSettings(tenant_id, settingsArray) {
    console.log(`[Settings] Upserting ${settingsArray.length} keys for tenant: ${tenant_id}`);
    
    // Filter out undefined/null values to avoid saving literal "undefined" strings
    const sanitized = settingsArray.filter(s => s.value !== undefined && s.value !== null);

    const upserts = sanitized.map(({ key, value }) => {
        let finalValue = String(value);
        if (SENSITIVE_KEYS.includes(key) && value && value !== '********') {
            finalValue = encrypt(finalValue);
        }
        return { tenant_id, key, value: finalValue };
    });

    // Filter out '********' masked values so we don't overwrite legit DB hashes
    const validUpserts = upserts.filter(u => !(SENSITIVE_KEYS.includes(u.key) && u.value === '********'));

    if (validUpserts.length > 0) {
        console.log(`[Settings] Executing DB Upsert for keys:`, validUpserts.map(u => u.key).join(', '));
        const { error } = await supabase.from('app_settings').upsert(validUpserts, { onConflict: 'tenant_id,key' });
        if (error) {
            console.error('[Settings] DB Upsert Error:', error.message);
            throw error;
        }
        
        // Invalidate Cache for this tenant
        delete settingsCache[tenant_id];
        delete cacheTimestamps[tenant_id];
        console.log(`[Settings] Cache invalidated for tenant: ${tenant_id}`);
    }
}

module.exports = {
    getAllSettings,
    getSetting,
    upsertSettings,
    SENSITIVE_KEYS
};
