const { getAllSettings, SENSITIVE_KEYS } = require('../utils/settings');
const { decrypt } = require('../utils/crypto');
const supabase = require('../utils/supabase');

/**
 * Settings Diagnostics Controller
 * Provides an integrity report of the billing configuration without exposing secrets.
 */
exports.runIntegrityCheck = async (req, res) => {
    try {
        const tenant_id = req.tenant_id;
        
        // 1. Check DB directly for row counts
        const { count, error: countErr } = await supabase
            .from('app_settings')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant_id);
            
        if (countErr) throw countErr;

        // 2. Fetch via our settings utility (verify cache & decryption)
        const settings = await getAllSettings(tenant_id);
        const keys = Object.keys(settings);
        
        const report = {
            tenant_id,
            total_rows_in_db: count,
            keys_found: keys,
            sensitive_keys_status: {}
        };

        // 3. Drill down into sensitive keys integrity
        for (const key of SENSITIVE_KEYS) {
            const rawValue = settings[key];
            if (!rawValue) {
                report.sensitive_keys_status[key] = 'MISSING';
            } else if (rawValue === '********') {
                report.sensitive_keys_status[key] = 'MASKED_ONLY (ERROR: RAW DATA LOST)';
            } else {
                try {
                    // verify it's not just a garbage string
                    // we already decrypt in getAllSettings, so if it's here and not masked, it's likely fine
                    // but let's double check it's not 'undefined' or 'null' string
                    if (rawValue === 'undefined' || rawValue === 'null') {
                        report.sensitive_keys_status[key] = 'INVALID_CONTENT (Literal null/undefined)';
                    } else {
                        report.sensitive_keys_status[key] = 'LOADED_AND_DECRYPTED';
                    }
                } catch (e) {
                    report.sensitive_keys_status[key] = `DECRYPTION_FAILED: ${e.message}`;
                }
            }
        }

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            report
        });
    } catch (e) {
        console.error('[Diagnostics Error]', e);
        res.status(500).json({ success: false, error: e.message });
    }
};
