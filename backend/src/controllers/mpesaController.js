const supabase = require('../utils/supabase');
const axios = require('axios');
const { internalReconnectAccount } = require('./mikrotikController');
const { getSetting } = require('../utils/settings');

// ---------------------------------------------------------
// RENEWAL CORE LOGIC
// ---------------------------------------------------------
async function applyPaymentAndRenew(tenant_id, customerId, amount, isNewModel = false) {
    const table = isNewModel ? 'services' : 'customers';
    const matchCol = isNewModel ? 'service_id' : 'customer_id';
    
    const { data: records } = await supabase
        .from(table)
        .select(`id, balance, status, next_due_date, router_id, username, tenant_id, packages(price, billing_cycle_months)`)
        .eq('tenant_id', tenant_id)
        .eq('id', customerId)
        .limit(1);

    if (!records?.[0]) return;
    
    const record = records[0];
    let newBalance = (parseFloat(record.balance) || 0) - amount;
    let carryForward = 0;

    // Handle Overpayment (Carry Forward)
    if (newBalance < 0) {
        carryForward = Math.abs(newBalance);
        newBalance = 0; // Balance cannot be negative if we use carry_forward instead
    }
    
    let newStatus = record.status;
    let newDueDate = record.next_due_date;
    let reconnected = false;

    const pkgPrice = record.packages ? parseFloat(record.packages.price) || 0 : Infinity;

    // Standard ISP renewal logic: if debt clears, advance the cycle
    if (newBalance <= 0 && pkgPrice > 0) {
        const months = record.packages?.billing_cycle_months || 1;
        const dateObj = newDueDate ? new Date(newDueDate) : new Date();
        
        let baseDate = dateObj;
        if (record.status === 'suspended' || dateObj < new Date()) {
            baseDate = new Date(); 
        }
        baseDate.setMonth(baseDate.getMonth() + months);
        newDueDate = baseDate.toISOString().split('T')[0];
        
        if (record.status === 'suspended') {
            newStatus = 'active';
            reconnected = true;
        }

        // ==========================================
        // Settle Any Existing Unpaid Invoices
        // ==========================================
        await supabase.from('invoices')
            .update({ status: 'paid', notes: 'Auto-settled via M-Pesa payment clearing balance' })
            .eq('tenant_id', tenant_id)
            .eq(matchCol, customerId)
            .eq('status', 'unpaid');
    }

    await supabase.from(table).update({ 
        balance: newBalance,
        carry_forward: carryForward,
        status: newStatus,
        next_due_date: newDueDate 
    }).eq('tenant_id', tenant_id).eq('id', customerId);

    if (reconnected && record.router_id && record.username) {
        try {
            await internalReconnectAccount(tenant_id, record.router_id, record.username);
            console.log(`[Billing Engine] Auto-reconnected ${record.username}`);
        } catch (e) {
             console.error(`[Billing Engine] Failed to auto-reconnect ${record.username}:`, e.message);
        }
    }
    return carryForward;
}

// Safaricom Production URLs
const OAUTH_URL = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const STK_PUSH_URL = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

/**
 * Get OAuth Access Token from Safaricom
 */
const getOAuthToken = async (tenant_id) => {
    const consumerKey = await getSetting(tenant_id, 'mpesa_consumer_key');
    const consumerSecret = await getSetting(tenant_id, 'mpesa_consumer_secret');
    
    if (!consumerKey || !consumerSecret) {
        throw new Error('M-Pesa Consumer Key/Secret not configured. Please check Settings.');
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    try {
        const { data } = await axios.get(OAUTH_URL, {
            headers: { Authorization: `Basic ${auth}` }
        });
        return data.access_token;
    } catch (e) {
        console.error('[M-Pesa Auth Error]', e.response?.data || e.message);
        throw new Error('Failed to authenticate with Safaricom.');
    }
};

/**
 * Generate Timestamp (YYYYMMDDHHmmss)
 */
const getTimestamp = () => {
    const now = new Date();
    return now.getFullYear() +
        ('0' + (now.getMonth() + 1)).slice(-2) +
        ('0' + now.getDate()).slice(-2) +
        ('0' + now.getHours()).slice(-2) +
        ('0' + now.getMinutes()).slice(-2) +
        ('0' + now.getSeconds()).slice(-2);
};

// ---------------------------------------------------------
// INITIATE STK PUSH
// ---------------------------------------------------------
exports.initiateStkPush = async (req, res) => {
    const { phone, amount, customer_id } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone and Amount are required.' });
    }

    // Clean phone number: 2547xxxxxxxx or 2541xxxxxxxx
    let cleanPhone = phone.replace(/\+/g, '').replace(/^0/, '254');
    if (!cleanPhone.startsWith('254')) cleanPhone = `254${cleanPhone}`;

    try {
        const token = await getOAuthToken(req.tenant_id);
        const shortCode = await getSetting(req.tenant_id, 'mpesa_paybill');
        const passkey = await getSetting(req.tenant_id, 'mpesa_passkey');
        const callbackUrl = 'https://movecconnect.com/api/mpesa/callback';

        if (!shortCode || !passkey) {
            return res.status(400).json({ error: 'M-Pesa Shortcode or Passkey missing in server config.' });
        }

        const timestamp = getTimestamp();
        const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');

        const payload = {
            BusinessShortCode: shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline', // Paybill type
            Amount: Math.round(amount),
            PartyA: cleanPhone,
            PartyB: shortCode,
            PhoneNumber: cleanPhone,
            CallBackURL: callbackUrl,
            AccountReference: 'MovecConnect',
            TransactionDesc: `Pay Subscription - ${customer_id || 'Topup'}`
        };

        const { data } = await axios.post(STK_PUSH_URL, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // ==========================================
        // Fetch Account Number for STK Tracking
        // ==========================================
        let accNum = customer_id || 'Unknown';
        
        // If it's a UUID, look it up. Otherwise, assume it's already an account number reference.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(customer_id);
        
        if (isUuid) {
            const { data: custInfo } = await supabase.from('customers').select('account_number').eq('id', customer_id).limit(1);
            if (custInfo?.[0]) accNum = custInfo[0].account_number;
            else {
                const { data: srvInfo } = await supabase.from('services').select('account_number').eq('id', customer_id).limit(1);
                if (srvInfo?.[0]) accNum = srvInfo[0].account_number;
            }
        }

        // ==========================================
        // Register STK Request mapping globally
        // ==========================================
        if (data.CheckoutRequestID) {
            await supabase.from('mpesa_stk_requests').insert([{
                checkout_request_id: data.CheckoutRequestID,
                merchant_request_id: data.MerchantRequestID || null,
                tenant_id: req.tenant_id,
                account_number: accNum,
                amount: Math.round(amount),
                phone: cleanPhone
            }]);
        }

        res.json({ success: true, daraja: data });
    } catch (e) {
        console.error('[STK Push Error]', e.response?.data || e.message);
        res.status(500).json({ error: e.response?.data?.errorMessage || e.message });
    }
};

// ---------------------------------------------------------
// M-PESA STK PUSH IPN CALLBACK (Safaricom → Our Server)
// ---------------------------------------------------------
exports.ipnCallback = async (req, res) => {
    // Respond immediately to Safaricom
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

    try {
        const body = req.body;
        const stkCallback = body?.Body?.stkCallback;

        if (!stkCallback || stkCallback.ResultCode !== 0) {
            console.log(`[M-Pesa IPN] Failed transaction. Code: ${stkCallback?.ResultCode} — ${stkCallback?.ResultDesc}`);
            return;
        }

        const metadata = stkCallback.CallbackMetadata?.Item || [];
        const get = (name) => metadata.find(i => i.Name === name)?.Value;

        const amount       = parseFloat(get('Amount')) || 0;
        const txnCode      = get('MpesaReceiptNumber');
        const rawPhone     = get('PhoneNumber')?.toString();
        const phone        = rawPhone?.replace(/^254/, '0'); // normalize to 07xx
        
        // Retrieve explicit CheckoutRequestID to link STK push
        const checkoutReqId = stkCallback.CheckoutRequestID;
        
        if (!txnCode || !amount) return;

        let resolvedTenantId = null;
        let resolvedCustomerId = null; // Can hold either customers.id or services.id reference for the ledger
        let resolvedAccountNum = null;
        let isNewModel = false;

        // ==========================================
        // Priority 1: Match by CheckoutRequestID explicitly (Bulletproof)
        // ==========================================
        if (checkoutReqId) {
            const { data: stkInfo } = await supabase.from('mpesa_stk_requests')
                .select('account_number, tenant_id').eq('checkout_request_id', checkoutReqId).limit(1);
            if (stkInfo?.[0]) {
                resolvedAccountNum = stkInfo[0].account_number;
                resolvedTenantId = stkInfo[0].tenant_id;
            }
        }

        // Priority 2: Standard PayBill Fallback -> Extract BillRefNumber
        if (!resolvedAccountNum) {
            resolvedAccountNum = get('AccountReference') || body?.Body?.stkCallback?.BillRefNumber;
        }

        // ==========================================
        // Hunt the Account Number across Models
        // ==========================================
        if (resolvedAccountNum) {
            // Check Services First (New Model)
            const { data: srvs } = await supabase.from('services').select('id, tenant_id').eq('account_number', resolvedAccountNum).limit(1);
            if (srvs?.[0]) {
                resolvedCustomerId = srvs[0].id;
                resolvedTenantId = srvs[0].tenant_id;
                isNewModel = true;
            } else {
                // Keep looking in Legacy Customers
                const { data: custs } = await supabase.from('customers').select('id, tenant_id').eq('account_number', resolvedAccountNum).limit(1);
                if (custs?.[0]) {
                    resolvedCustomerId = custs[0].id;
                    resolvedTenantId = custs[0].tenant_id;
                }
            }
        }

        // ==========================================
        // Priority 3: Blind Phone Number Fallback
        // ==========================================
        if (!resolvedCustomerId && phone) {
            const normalized = [phone, `+254${phone.slice(1)}`, `254${phone.slice(1)}`];
            
            // Check legacy mapping
            const { data: customers } = await supabase.from('customers').select('id, tenant_id').in('phone', normalized).limit(1);
            if (customers?.[0]) {
                resolvedCustomerId = customers[0].id;
                resolvedTenantId = customers[0].tenant_id;
            } else {
                // If the new system's Person table has the phone, we could map, but STK implies direct service.
                // We'll trust exact routing over phone guessing moving forward.
            }
        }

        // Apply Payment
        // Apply Payment
        let carryForwardApplied = 0;
        if (resolvedCustomerId) {
            carryForwardApplied = await applyPaymentAndRenew(resolvedTenantId, resolvedCustomerId, amount, isNewModel);
        }

        // Record STK success state
        if (checkoutReqId) {
            await supabase.from('mpesa_stk_requests').update({ status: 'success' }).eq('checkout_request_id', checkoutReqId);
        }

        // Record standard payment ledger
        const fallbackTenant = '00000000-0000-0000-0000-000000000001';
        await supabase.from('payments').insert([{
            tenant_id:        resolvedTenantId || fallbackTenant,
            customer_id:      isNewModel ? null : resolvedCustomerId,
            service_id:       isNewModel ? resolvedCustomerId : null,
            amount:           amount,
            carry_forward_applied: carryForwardApplied,
            method:           'M-Pesa',
            transaction_code: txnCode,
            status:           'completed',
            notes:            resolvedCustomerId ? `Auto-cleared via AccountRef: ${resolvedAccountNum || phone}` : `Unmatched phone/ref`
        }]);

    } catch (err) {
        console.error('[M-Pesa IPN Error]', err.message);
    }
};

// ---------------------------------------------------------
// MANUAL PAYMENT RECORDING
// ---------------------------------------------------------
exports.recordManualPayment = async (req, res) => {
    const { customer_id, amount, method, transaction_code, notes, invoice_id } = req.body;

    if (!customer_id || !amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: 'customer_id and a valid amount are required.' });
    }

    try {
        // 1. Detect Model
        let isNewModel = false;
        const { data: srv } = await supabase.from('services').select('id').eq('tenant_id', req.tenant_id).eq('id', customer_id).limit(1);
        if (srv?.[0]) isNewModel = true;

        // 2. Insert Payment Record
        const { data: payment, error: payErr } = await supabase
            .from('payments')
            .insert([{
                tenant_id: req.tenant_id,
                customer_id: isNewModel ? null : customer_id,
                service_id: isNewModel ? customer_id : null,
                invoice_id: invoice_id || null,
                amount:           parseFloat(amount),
                method:           method || 'Cash',
                transaction_code: transaction_code || null,
                status:           'completed',
                notes:            notes || null
            }])
            .select()
            .single();

        if (payErr) throw payErr;

        // 3. Apply Renewal Logic
        const carryForwardApplied = await applyPaymentAndRenew(req.tenant_id, customer_id, parseFloat(amount), isNewModel);
        
        // Update payment with carry forward if any
        if (carryForwardApplied > 0) {
            await supabase.from('payments').update({ carry_forward_applied: carryForwardApplied }).eq('id', payment.id);
        }

        if (invoice_id) {
            await supabase.from('invoices').update({ status: 'paid' }).eq('tenant_id', req.tenant_id).eq('id', invoice_id);
        }

        res.json({ success: true, payment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// ---------------------------------------------------------
// GET STK PUSH STATUS
// ---------------------------------------------------------
exports.getStkStatus = async (req, res) => {
    const { checkoutRequestId } = req.params;

    try {
        const { data, error } = await supabase
            .from('mpesa_stk_requests')
            .select('status, amount, phone, account_number')
            .eq('checkout_request_id', checkoutRequestId)
            .single();

        if (error) throw error;

        // If success, we can also look for the actual payment record to get the txn code
        let transactionCode = null;
        if (data.status === 'success') {
            const { data: payment } = await supabase
                .from('payments')
                .select('transaction_code')
                .eq('tenant_id', req.tenant_id)
                .eq('amount', data.amount)
                .order('created_at', { ascending: false })
                .limit(1);
            if (payment?.[0]) transactionCode = payment[0].transaction_code;
        }

        res.json({ success: true, status: data.status, transactionCode });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
