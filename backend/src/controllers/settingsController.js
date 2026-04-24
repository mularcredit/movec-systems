const { getAllSettings, upsertSettings, SENSITIVE_KEYS, getSetting } = require('../utils/settings');
const axios = require('axios');

exports.getSettings = async (req, res) => {
    try {
        const settings = await getAllSettings(req.tenant_id);
        
        // Mask passwords/tokens before sending to UI
        const masked = { ...settings };
        Object.keys(masked).forEach(key => {
            if (SENSITIVE_KEYS.includes(key) && masked[key]) {
                masked[key] = '********';
            }
        });

        res.json({ success: true, settings: masked });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.saveSettings = async (req, res) => {
    const { settings } = req.body;
    if (!Array.isArray(settings)) return res.status(400).json({ error: 'settings must be an array.' });

    try {
        await upsertSettings(req.tenant_id, settings);
        res.json({ success: true, message: 'Settings successfully applied.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.testMpesa = async (req, res) => {
    let { consumerKey, consumerSecret } = req.body;
    
    try {
        // Resolve masked values from DB if needed
        if (consumerKey === '********') {
            consumerKey = await getSetting(req.tenant_id, 'mpesa_consumer_key');
        }
        if (consumerSecret === '********') {
            consumerSecret = await getSetting(req.tenant_id, 'mpesa_consumer_secret');
        }

        if (!consumerKey || !consumerSecret) {
            return res.status(400).json({ error: 'Missing Keys to run test. If they are already saved, ensure they are not empty in the database.' });
        }

        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const OAUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
        
        const { data } = await axios.get(OAUTH_URL, {
            headers: { Authorization: `Basic ${auth}` }
        });
        
        if (data && data.access_token) {
            res.json({ success: true, message: 'Authentication Successful! Keys are valid.' });
        } else {
            throw new Error('Safaricom disconnected without token parsing.');
        }
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.errorMessage || e.message });
    }
};
