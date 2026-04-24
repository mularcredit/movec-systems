const supabase = require('../utils/supabase');
const networkVendorService = require('../services/networkVendorService');
const mikrotikService = require('../services/mikrotikService'); // kept for logProvisioning
const { encrypt } = require('../utils/crypto');
const axios = require('axios');
const { getAllSettings } = require('../utils/settings');

const CELCOM_URL = 'https://isms.celcomafrica.com/api/services/sendsms/';

// ─────────────────────────────────────────────────────────────
// SMS UTILITY (fire-and-forget, never blocks provisioning)
// ─────────────────────────────────────────────────────────────
async function sendWelcomeSms(tenant_id, phone, fullName, accountNumber, packageName) {
    try {
        const cfg = await getAllSettings(tenant_id);
        if (!cfg.celcom_api_key || !cfg.celcom_partner_id) return; // SMS not configured, skip silently

        const firstName = fullName.split(' ')[0];
        const message   = `Welcome to Movec Connect, ${firstName}! Your account (${accountNumber}) is now active on ${packageName}. For support: support@movec.co.ke`;

        await axios.post(CELCOM_URL, {
            apikey:    cfg.celcom_api_key,
            partnerID: cfg.celcom_partner_id,
            shortcode: cfg.sms_sender_id || 'MOVEC',
            mobile:    phone,
            message
        });

        // Log the message
        const { error: msgErr } = await supabase.from('message_logs').insert([{
            tenant_id,
            channel: 'sms',
            recipient: phone,
            message,
            status: 'sent'
        }]);
        if (msgErr) console.warn('[Provision SMS Log Failed]', msgErr.message);

    } catch (e) {
        console.warn('[Provision SMS] Failed to send welcome SMS:', e.message);
    }
}

// =============================================================================
// DB STATUS UPDATE — with one automatic retry before alerting
// =============================================================================
async function updateServiceStatus(tenant_id, serviceId, status) {
    const attempt = async () =>
        supabase.from('services').update({ status }).eq('tenant_id', tenant_id).eq('id', serviceId);

    const { error: firstErr } = await attempt();
    if (!firstErr) return { ok: true };

    console.warn(
        `[Service Controller] DB update to '${status}' failed for ${serviceId}. ` +
        `Retrying in 800ms... (${firstErr.message})`
    );
    await new Promise(r => setTimeout(r, 800));

    const { error: secondErr } = await attempt();
    if (!secondErr) {
        console.log(`[Service Controller] DB retry to '${status}' succeeded for ${serviceId}.`);
        return { ok: true };
    }

    return { ok: false, error: secondErr };
}

// Helper to generate account number securely
const genAccountNumber = () => 'SVC-' + Date.now().toString(36).toUpperCase().slice(-6);

// =============================================================================
// ENTERPRISE PROVISIONING MULTI-STEP LOGIC
// =============================================================================
exports.provisionService = async (req, res) => {
    const { identity, location, service, payment = {} } = req.body;
    let personId = identity.id;
    let propertyId = location.property_id;
    let unitId = null;

    try {
        // ── 1. IDENTITY HANDLING ───────────────────────────────────────────────
        if (!personId) {
            // Create new person
            if (!identity.fullName || !identity.phone) {
                return res.status(400).json({ error: 'Full name and phone are required for a new identity.' });
            }

            // CHECK FOR DUPLICATES WITHIN TENANT
            const { data: duplicates } = await supabase.from('persons')
                .select('id, full_name, phone, email')
                .eq('tenant_id', req.tenant_id)
                .or(`phone.eq.${identity.phone}${identity.email ? `,email.eq.${identity.email}` : ''}`)
                .limit(1);

            if (duplicates && duplicates.length > 0) {
                const dup = duplicates[0];
                const matchedField = dup.phone === identity.phone ? 'phone number' : 'email address';
                return res.status(409).json({ 
                    error: `A customer named "${dup.full_name}" already exists with this ${matchedField}. Please use the "Existing Customer" option instead.` 
                });
            }

            const { data: newPerson, error: pErr } = await supabase.from('persons').insert([{
                tenant_id: req.tenant_id,
                full_name: identity.fullName,
                phone: identity.phone,
                email: identity.email || null
            }]).select('id').single();

            if (pErr) throw new Error(`Identity creation failed: ${pErr.message}`);
            personId = newPerson.id;
        }

        // ── 2. LOCATION HANDLING ───────────────────────────────────────────────
        if (location.propertyName && !propertyId) {
            // Create new property
            const { data: newProp, error: propErr } = await supabase.from('properties').insert([{
                tenant_id: req.tenant_id,
                name: location.propertyName,
                location: location.area || null
            }]).select('id').single();

            if (propErr) throw new Error(`Property creation failed: ${propErr.message}`);
            propertyId = newProp.id;
        }

        if (propertyId && location.unitNumber) {
            // Does unit exist? If not, create it.
            const { data: existingUnits } = await supabase.from('units')
                .select('id').eq('property_id', propertyId).eq('unit_number', location.unitNumber).limit(1);

            if (existingUnits?.[0]) {
                unitId = existingUnits[0].id;
            } else {
                const { data: newUnit, error: uErr } = await supabase.from('units').insert([{
                    property_id: propertyId,
                    unit_number: location.unitNumber
                }]).select('id').single();

                if (uErr) throw new Error(`Unit creation failed: ${uErr.message}`);
                unitId = newUnit.id;
            }
        }

        // ── 3. SERVICE VALIDATION & PACKAGE RESOLUTION ─────────────────────────
        if (!service.service_type || !service.package_id) {
            return res.status(400).json({ error: 'Service Type and Package are required.' });
        }

        const { data: pkg, error: pkgErr } = await supabase.from('packages')
            .select('display_name, service_type, router_ppp_profile, router_hotspot_profile, speed_down_mbps, speed_up_mbps, radius_rate_limit')
            .eq('tenant_id', req.tenant_id)
            .eq('id', service.package_id)
            .single();

        if (pkgErr || !pkg) return res.status(400).json({ error: 'Package not found or invalid.' });

        if (service.service_type !== 'Static' && pkg.service_type !== service.service_type) {
            return res.status(400).json({
                error: `Mismatch: Trying to provision ${service.service_type} on a ${pkg.service_type} package.`
            });
        }

        // Fetch full router record to resolve vendor
        let routerRecord = null;
        if (service.router_id) {
            const { data: r } = await supabase.from('routers')
                .select('id, vendor, vendor_config, ip_address, tenant_id')
                .eq('id', service.router_id).single();
            routerRecord = r || null;
        }

        // MikroTik-specific: validate profile mapping
        let routerProfile = null;
        if (routerRecord && routerRecord.vendor === 'mikrotik' && service.service_type !== 'Static') {
            routerProfile = service.service_type === 'Hotspot' ? pkg.router_hotspot_profile : pkg.router_ppp_profile;
            if (!routerProfile) return res.status(400).json({ error: `Router profile missing on package '${pkg.display_name}'. Set the PPPoE/Hotspot profile name.` });
        }

        // ── 4. SERVICE RECORD CREATION ──────────────────────────────────────────
        let encryptedPassword   = service.ppp_password ? encrypt(service.ppp_password) : null;
        let generatedAccountNum = service.accountNumber || genAccountNumber();

        // ── Payment calculations ────────────────────────────────────────────────
        const { data: pkgFull } = await supabase.from('packages')
            .select('price')
            .eq('id', service.package_id)
            .single();
        const packagePrice = parseFloat(pkgFull ? pkgFull.price : 0);

        const paymentCategory  = payment.category  || 'full';
        const amountPaid       = parseFloat(payment.amount_paid   || 0);
        const discountAmount   = parseFloat(payment.discount_amount || 0);
        const effectivePrice   = packagePrice - discountAmount;
        const balanceDue       = paymentCategory === 'already_paid' ? 0 :
                                 paymentCategory === 'full'         ? Math.max(0, effectivePrice - amountPaid) :
                                 Math.max(0, effectivePrice - amountPaid);
        const balanceDueDate   = payment.balance_due_date || null;

        const { data: newService, error: sErr } = await supabase.from('services').insert([{
            tenant_id:          req.tenant_id,
            person_id:          personId,
            unit_id:            unitId || null,
            router_id:          service.router_id || null,
            package_id:         service.package_id,
            account_number:     generatedAccountNum,
            service_type:       service.service_type,
            username:           service.ppp_username || null,
            password_encrypted: encryptedPassword,
            ip_address:         service.ip_address || null,
            next_due_date:      service.next_due_date || null,
            status:             'pending',
            balance:            0,
            // Payment fields
            payment_category:   paymentCategory,
            amount_paid:        amountPaid,
            discount_amount:    discountAmount,
            balance_due:        balanceDue,
            balance_due_date:   balanceDue > 0 ? balanceDueDate : null
        }]).select('*, persons(full_name, phone)').single();

        if (sErr) throw new Error(`Service creation failed: ${sErr.message}`);

        // ── 5. RECORD PAYMENT IN LEDGER ─────────────────────────────────────────
        if (amountPaid > 0 || paymentCategory === 'already_paid') {
            const recordedAmount = paymentCategory === 'already_paid' ? packagePrice : amountPaid;
            if (recordedAmount > 0) {
                const { error: ledgerErr } = await supabase.from('payments').insert([{
                    tenant_id:        req.tenant_id,
                    service_id:       newService.id,
                    amount:           recordedAmount,
                    method:           payment.method      || 'Cash',
                    transaction_code: payment.txn_code    || null,
                    notes:            payment.notes       || `Onboarding payment — ${paymentCategory}`,
                    status:           'completed',
                    paid_at:          new Date().toISOString()
                }]);
                if (ledgerErr) console.warn('[Provision Payment Log]', ledgerErr.message);
            }
        }

        // ── 6. VENDOR-ROUTED PROVISIONING ─────────────────────────────────────
        if (newService.router_id && newService.service_type !== 'Static') {
            try {
                const vendor = routerRecord ? (routerRecord.vendor || 'mikrotik') : 'mikrotik';
                const driver = networkVendorService.getDriver(vendor);

                const servicePayload = {
                    ...newService,
                    full_name: newService.persons ? newService.persons.full_name : 'Enterprise Service'
                };

                const provisionResult = await driver.provisionService(
                    req.tenant_id,
                    routerRecord,
                    servicePayload,
                    pkg,
                    service.ppp_password
                );

                const activate = await updateServiceStatus(req.tenant_id, newService.id, 'active');
                if (!activate.ok) {
                    return res.status(207).json({
                        success: true, partial_success: true,
                        warning: 'Service active on network but DB sync failed.',
                        service: { ...newService, status: 'pending' },
                        provisioning: provisionResult
                    });
                }

                // Fire SMS (non-blocking)
                if (payment.send_sms !== false && newService.persons && newService.persons.phone) {
                    sendWelcomeSms(
                        req.tenant_id,
                        newService.persons.phone,
                        newService.persons.full_name,
                        generatedAccountNum,
                        pkg.display_name
                    );
                }

                return res.json({
                    success: true,
                    service: { ...newService, status: 'active' },
                    provisioning: provisionResult
                });

            } catch (pErr) {
                await updateServiceStatus(req.tenant_id, newService.id, 'provision_failed');
                return res.status(207).json({
                    success: false, partial_success: true,
                    error: pErr.message,
                    service: { ...newService, status: 'provision_failed' }
                });
            }
        }

        // Static or no Router -> Activate instantly
        await supabase.from('services').update({ status: 'active' }).eq('id', newService.id);

        // Fire SMS (non-blocking)
        if (payment.send_sms !== false && newService.persons && newService.persons.phone) {
            sendWelcomeSms(
                req.tenant_id,
                newService.persons.phone,
                newService.persons.full_name,
                generatedAccountNum,
                pkg.display_name
            );
        }

        return res.json({ success: true, service: { ...newService, status: 'active' } });

    } catch (err) {
        console.error('[Provision Service Error]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// =============================================================================
// CHANGE AUTHENTICATION PASSWORD
// =============================================================================
exports.changeServicePassword = async (req, res) => {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) return res.status(400).json({ error: 'New password is required.' });

    try {
        const { data: service, error: sErr } = await supabase.from('services')
            .select('id, tenant_id, router_id, username, service_type, routers(vendor)')
            .eq('tenant_id', req.tenant_id)
            .eq('id', id)
            .single();

        if (sErr || !service) return res.status(404).json({ error: 'Service not found.' });
        if (!service.router_id || !service.username) return res.status(400).json({ error: 'Service is not actively provisioned on a router.' });

        const encrypted = encrypt(new_password);

        const routerVendor = service.routers?.vendor || 'mikrotik';
        const driver = networkVendorService.getDriver(routerVendor);

        // Update via Vendor Driver
        await driver.updatePassword(service.tenant_id, service.router_id, service.service_type, service.username, new_password, encrypted);

        // Update Database
        await supabase.from('services').update({ password_encrypted: encrypted }).eq('id', id);

        return res.json({ success: true, message: 'Password updated successfully on database and router.' });
    } catch (err) {
        console.error('[Change Password Error]', err.message);
        return res.status(500).json({ error: err.message });
    }
};

// =============================================================================
// FETCH ROUTER ACTIVITY LOGS
// =============================================================================
exports.getServiceLogs = async (req, res) => {
    const { id } = req.params;

    try {
        const { data: service, error: sErr } = await supabase.from('services')
            .select('tenant_id, router_id, username')
            .eq('tenant_id', req.tenant_id)
            .eq('id', id)
            .single();

        if (sErr || !service) return res.status(404).json({ error: 'Service not found.' });
        if (!service.router_id || !service.username) return res.json({ success: true, logs: [] });

        const logs = await mikrotikService.getUserLogs(service.tenant_id, service.router_id, service.username);
        
        return res.json({ success: true, logs });
    } catch (err) {
        console.error('[Get Logs Error]', err.message);
        return res.status(500).json({ error: err.message });
    }
};
