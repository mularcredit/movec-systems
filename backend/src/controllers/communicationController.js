const axios  = require('axios');
const supabase = require('../utils/supabase');
const { getAllSettings } = require('../utils/settings');

const CELCOM_URL = 'https://isms.celcomafrica.com/api/services/sendsms/';
const WA_URL     = 'https://graph.facebook.com/v18.0';

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------
const getSettings = async (tenant_id) => {
    return await getAllSettings(tenant_id);
};

const logMessage = async (tenant_id, channel, recipient, message, status, customer_id = null, external_id = null) => {
    await supabase.from('message_logs').insert([{
        tenant_id, customer_id, channel, recipient, message, status, external_id
    }]).catch(err => console.warn('[MsgLog]', err.message));
};

const personalize = (template, customer) => template
    .replace(/{name}/gi,       customer.full_name?.split(' ')[0] || customer.full_name || '')
    .replace(/{full_name}/gi,  customer.full_name || '')
    .replace(/{account}/gi,    customer.account_number || '')
    .replace(/{due_date}/gi,   customer.next_due_date  || 'N/A')
    .replace(/{phone}/gi,      customer.phone || '');

// -----------------------------------------------------------
// Single SMS (Celcom)
// -----------------------------------------------------------
exports.sendSms = async (req, res) => {
    const { mobile, message, customer_id } = req.body;
    if (!mobile || !message) return res.status(400).json({ error: 'mobile and message are required.' });

    const cfg = await getSettings(req.tenant_id);
    if (!cfg.celcom_api_key || !cfg.celcom_partner_id) {
        return res.status(400).json({ error: 'Celcom SMS not configured. Add credentials in Settings → Communication.' });
    }

    try {
        const payload = {
            apikey:    cfg.celcom_api_key,
            partnerID: cfg.celcom_partner_id,
            shortcode: cfg.sms_sender_id || 'MOVEC',
            mobile,
            message
        };
        const { data: result } = await axios.post(CELCOM_URL, payload);
        const status = result?.responses?.[0]?.response_code === 200 ? 'sent' : 'failed';
        await logMessage(req.tenant_id, 'sms', mobile, message, status, customer_id, result?.responses?.[0]?.messageid);
        res.json({ success: true, status, celcom: result });
    } catch (e) {
        await logMessage(req.tenant_id, 'sms', mobile, message, 'failed', customer_id);
        res.status(500).json({ error: e.message });
    }
};

// -----------------------------------------------------------
// Bulk SMS — filter-based or explicit customer_ids
// -----------------------------------------------------------
exports.sendBulkSms = async (req, res) => {
    const { filter, customer_ids, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required.' });

    const cfg = await getSettings(req.tenant_id);
    if (!cfg.celcom_api_key || !cfg.celcom_partner_id) {
        return res.status(400).json({ error: 'Celcom SMS not configured.' });
    }

    // Build customer query
    let query = supabase.from('customers').select('id, full_name, phone, account_number, next_due_date, status').eq('tenant_id', req.tenant_id);
    if (filter === 'active')    query = query.eq('status', 'active');
    else if (filter === 'suspended') query = query.eq('status', 'suspended');
    else if (filter === 'expiring') {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 3);
        query = query.lte('next_due_date', cutoff.toISOString()).eq('status', 'active');
    } else if (filter === 'overdue') {
        query = query.lt('next_due_date', new Date().toISOString()).eq('status', 'active');
    } else if (customer_ids?.length) {
        query = query.in('id', customer_ids);
    }

    const { data: customers, error } = await query;
    if (error || !customers?.length) return res.status(400).json({ error: 'No customers matched.' });

    const results = { sent: 0, failed: 0, skipped: 0, total: customers.length };
    const shortcode = cfg.sms_sender_id || 'MOVEC';

    for (const customer of customers) {
        if (!customer.phone) { results.skipped++; continue; }
        const personalizedMsg = personalize(message, customer);
        try {
            const payload = {
                apikey:    cfg.celcom_api_key,
                partnerID: cfg.celcom_partner_id,
                shortcode,
                mobile:  customer.phone,
                message: personalizedMsg
            };
            const { data: result } = await axios.post(CELCOM_URL, payload);
            const status = result?.responses?.[0]?.response_code === 200 ? 'sent' : 'failed';
            await logMessage(req.tenant_id, 'sms', customer.phone, personalizedMsg, status, customer.id);
            status === 'sent' ? results.sent++ : results.failed++;
        } catch (_) {
            results.failed++;
            await logMessage(req.tenant_id, 'sms', customer.phone, personalizedMsg, 'failed', customer.id);
        }
        // Respect Celcom rate limits
        await new Promise(r => setTimeout(r, 120));
    }

    res.json({ success: true, results });
};

// -----------------------------------------------------------
// WhatsApp Business (Meta Cloud API)
// -----------------------------------------------------------
exports.sendWhatsApp = async (req, res) => {
    const { to, message, customer_id } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required.' });

    const cfg = await getSettings(req.tenant_id);
    if (!cfg.whatsapp_phone_id || !cfg.whatsapp_token) {
        return res.status(400).json({ error: 'WhatsApp Business not configured. Add credentials in Settings.' });
    }

    try {
        const { data: result } = await axios.post(
            `${WA_URL}/${cfg.whatsapp_phone_id}/messages`,
            { messaging_product: 'whatsapp', to, type: 'text', text: { body: message } },
            { headers: { Authorization: `Bearer ${cfg.whatsapp_token}`, 'Content-Type': 'application/json' } }
        );
        const msgId = result?.messages?.[0]?.id;
        await logMessage(req.tenant_id, 'whatsapp', to, message, 'sent', customer_id, msgId);
        res.json({ success: true, message_id: msgId });
    } catch (e) {
        await logMessage(req.tenant_id, 'whatsapp', to, message, 'failed', customer_id);
        res.status(500).json({ error: e.response?.data?.error?.message || e.message });
    }
};

// -----------------------------------------------------------
// Message Logs
// -----------------------------------------------------------
exports.getMessageLogs = async (req, res) => {
    const { data, error } = await supabase
        .from('message_logs')
        .select('id, channel, recipient, message, status, created_at, external_id, customers(full_name, account_number)')
        .eq('tenant_id', req.tenant_id)
        .order('created_at', { ascending: false })
        .limit(300);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, logs: data || [] });
};
