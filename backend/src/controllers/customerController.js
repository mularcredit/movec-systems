const supabase        = require('../utils/supabase');
const mikrotikService = require('../services/mikrotikService');
const { encrypt }     = require('../utils/crypto');

// =============================================================================
// DB STATUS UPDATE — with one automatic retry before alerting
// =============================================================================

/**
 * Tries to update the customer status in Supabase.
 * Retries once after 800ms if the first attempt fails.
 * Returns { ok: true } on success or { ok: false, error } after both attempts fail.
 */
async function updateServiceStatus(tenant_id, serviceId, status) {
    const attempt = async () =>
        supabase.from('services').update({ status }).eq('tenant_id', tenant_id).eq('id', serviceId);

    const { error: firstErr } = await attempt();
    if (!firstErr) return { ok: true };

    console.warn(
        `[Customer Controller] DB update to '${status}' failed for ${serviceId}. ` +
        `Retrying in 800ms... (${firstErr.message})`
    );
    await new Promise(r => setTimeout(r, 800));

    const { error: secondErr } = await attempt();
    if (!secondErr) {
        console.log(`[Customer Controller] DB retry to '${status}' succeeded for ${serviceId}.`);
        return { ok: true };
    }

    return { ok: false, error: secondErr };
}

// =============================================================================
// CREATE CUSTOMER
// =============================================================================

/**
 * POST /api/customers/create
 *
 * Request body:
 *   {
 *     profile: { fullName, phone, email, address, accountNumber },
 *     service: { service_type, package_id, router_id, ppp_username, ppp_password,
 *                ip_address, next_due_date }
 *   }
 *
 * NOTE: Frontend must NOT send package_name or any RouterOS profile identifier.
 * The backend is the single source of truth for profile resolution.
 *
 * Package → RouterOS profile resolution flow:
 *   1. Fetch packages row by package_id
 *   2. Verify service_type consistency (no fallback / no coercion)
 *   3. Read router_ppp_profile or router_hotspot_profile from packages row
 *   4. Pass that value to provisionUser — never the frontend-supplied name
 */
exports.createCustomer = async (req, res) => {
    // Destructure only { profile, service } — package_name is intentionally absent
    const { profile, service } = req.body;

    // ── Guard: required top-level fields ────────────────────────────────────────
    if (!profile?.fullName || !profile?.phone || !service?.service_type || !service?.package_id) {
        return res.status(400).json({ error: 'Missing required fields: profile.fullName, profile.phone, service.service_type, service.package_id.' });
    }

    // ── Guard: service_type is a known value ─────────────────────────────────────
    const VALID_SERVICE_TYPES = ['PPPoE', 'Hotspot', 'Static'];
    if (!VALID_SERVICE_TYPES.includes(service.service_type)) {
        return res.status(400).json({
            error: `Invalid service_type '${service.service_type}'. Must be one of: ${VALID_SERVICE_TYPES.join(', ')}.`
        });
    }

    // ── Guard: credentials required when a router is assigned and type is not Static ──
    if (service.router_id && service.service_type !== 'Static') {
        if (!service.ppp_username?.trim()) {
            return res.status(400).json({ error: 'PPP/Hotspot username is required when a router is assigned.' });
        }
        if (!service.ppp_password?.trim()) {
            return res.status(400).json({ error: 'PPP/Hotspot password is required when a router is assigned.' });
        }
    }

    try {
        // ── Step 1: Fetch package from DB — backend is sole resolver ────────────
        // The frontend sends only package_id. Profile name, service type, and
        // routing metadata are read exclusively from the packages table.
        const { data: pkg, error: pkgErr } = await supabase
            .from('packages')
            .select('display_name, service_type, router_ppp_profile, router_hotspot_profile')
            .eq('tenant_id', req.tenant_id)
            .eq('id', service.package_id)
            .single();

        if (pkgErr || !pkg) {
            return res.status(400).json({
                error: 'Package not found. Verify the package_id is valid and the package has not been deleted.'
            });
        }

        // ── Step 2: Enforce service_type consistency ─────────────────────────────
        // No fallback. No coercion. Hard reject on mismatch.
        // Static customers bypass this check — they carry a package for billing
        // purposes but do not use RouterOS profiles.
        if (service.service_type !== 'Static' && pkg.service_type !== service.service_type) {
            return res.status(400).json({
                error:
                    `Service type mismatch: package '${pkg.display_name}' is a ${pkg.service_type} package, ` +
                    `but the customer was enrolled as ${service.service_type}. ` +
                    `Either change the customer service type to ${pkg.service_type}, ` +
                    `or select a ${service.service_type} package.`
            });
        }

        // ── Step 3: Resolve router profile — DB-sourced, never from frontend ────
        // routerProfile will be null for Static (no router write needed).
        // For PPPoE/Hotspot it MUST be non-null — fail fast if not configured.
        let routerProfile = null;

        if (service.router_id && service.service_type !== 'Static') {
            routerProfile = service.service_type === 'Hotspot'
                ? pkg.router_hotspot_profile
                : pkg.router_ppp_profile;

            if (!routerProfile?.trim()) {
                const profileType = service.service_type === 'Hotspot' ? 'Hotspot' : 'PPP';
                return res.status(400).json({
                    error:
                        `Package '${pkg.display_name}' has no ${profileType} router profile configured. ` +
                        `Edit the package and set the Router ${profileType} Profile field before provisioning.`
                });
            }
        }

        // ── Step 4: Encrypt PPP password (never stored in plaintext) ────────────
        let encryptedPassword = null;
        if (service.ppp_password) {
            encryptedPassword = encrypt(service.ppp_password);
        }

        // ── Step 5: Insert Identity (Person) ────────────────────────────────────
        // Check if person exists by phone to avoid duplicates
        let personId;
        const { data: existingPerson } = await supabase.from('persons')
            .select('id').eq('phone', profile.phone).eq('tenant_id', req.tenant_id).single();

        if (existingPerson) {
            personId = existingPerson.id;
            // Update email if provided
            if (profile.email) await supabase.from('persons').update({ email: profile.email, full_name: profile.fullName }).eq('id', personId);
        } else {
            const { data: newPerson, error: pErr } = await supabase.from('persons').insert([{
                tenant_id: req.tenant_id,
                full_name: profile.fullName,
                phone: profile.phone,
                email: profile.email || null
            }]).select().single();
            if (pErr) throw new Error(`Person creation failed: ${pErr.message}`);
            personId = newPerson.id;
        }

        // ── Step 6: Insert Service — status starts as 'pending' ────────────────
        const { data: serviceRecord, error: dbError } = await supabase
            .from('services')
            .insert([{
                tenant_id:          req.tenant_id,
                person_id:          personId,
                account_number:     profile.accountNumber,
                service_type:       service.service_type,
                package_id:         service.package_id  || null,
                router_id:          service.router_id    || null,
                username:           service.ppp_username || null,
                password_encrypted: encryptedPassword,
                ip_address:         service.ip_address   || null,
                next_due_date:      service.next_due_date || null,
                status:             'pending',
                balance:            0
            }])
            .select()
            .single();

        if (dbError) throw new Error(`Service Database Error: ${dbError.message}`);

        // ── Step 7: Provision on MikroTik (if router assigned and not Static) ───
        if (service.router_id && service.service_type !== 'Static') {
            try {
                const provisionResult = await mikrotikService.provisionUser(
                    req.tenant_id,
                    service.router_id,
                    {
                        ...serviceRecord,
                        username:       service.ppp_username,
                        full_name:      profile.fullName,
                        account_number: profile.accountNumber,
                        ip_address:     service.ip_address
                    },
                    service.service_type,
                    routerProfile,
                    service.ppp_password
                );

                // ── 7a: Provision succeeded → activate ───────────────────────────
                const activate = await updateServiceStatus(req.tenant_id, serviceRecord.id, 'active');

                if (!activate.ok) {
                    return res.status(207).json({
                        success: true,
                        partial_success: true,
                        customer: { ...serviceRecord, full_name: profile.fullName },
                        provisioning: provisionResult
                    });
                }

                return res.json({
                    success:      true,
                    customer:     { ...serviceRecord, full_name: profile.fullName, status: 'active' },
                    provisioning: provisionResult
                });

            } catch (provisionErr) {
                // ── 7b: Provision failed → mark provision_failed ─────────────────
                await updateServiceStatus(req.tenant_id, serviceRecord.id, 'provision_failed');

                return res.status(207).json({
                    success:        false,
                    partial_success: true,
                    customer:       { ...serviceRecord, full_name: profile.fullName, status: 'provision_failed' },
                    error:          provisionErr.message
                });
            }
        }

        // ── Step 8: Static / no router — activate immediately ───────────────────
        await supabase.from('services').update({ status: 'active' }).eq('tenant_id', req.tenant_id).eq('id', serviceRecord.id);
        return res.json({ success: true, customer: { ...serviceRecord, full_name: profile.fullName, status: 'active' } });

    } catch (e) {
        console.error('[Customer Controller]', e.message);
        return res.status(500).json({ error: e.message });
    }
};

// =============================================================================
// GET CUSTOMER STATEMENT (FINANCIAL LEDGER ACROSS HYBRID MODELS)
// =============================================================================
exports.getCustomerStatement = async (req, res) => {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: 'Customer or Service ID required.' });

    try {
        // 1. Fetch Profile info (Trying customers first, fallback to services)
        let profile = null;
        let isNewModel = false;
        
        const { data: custs } = await supabase.from('customers').select('*').eq('tenant_id', req.tenant_id).eq('id', id).limit(1);
        if (custs?.[0]) profile = custs[0];
        else {
            const { data: srvs } = await supabase.from('services').select('*, persons(full_name, phone, email)').eq('tenant_id', req.tenant_id).eq('id', id).limit(1);
            if (srvs?.[0]) {
                profile = srvs[0];
                isNewModel = true;
            }
        }

        if (!profile) return res.status(404).json({ error: 'Identity not found.' });

        // 2. Fetch Payments Ledger
        const matchCol = isNewModel ? 'service_id' : 'customer_id';
        const { data: payments } = await supabase.from('payments').select('*').eq('tenant_id', req.tenant_id).eq(matchCol, id).order('paid_at', { ascending: false });
        
        // 3. Fetch Invoices Ledger
        const { data: invoices } = await supabase.from('invoices').select('*').eq('tenant_id', req.tenant_id).eq(matchCol, id).order('due_date', { ascending: false });

        return res.json({
            success: true,
            identity: {
                id: profile.id,
                name: isNewModel ? profile.persons?.full_name : profile.full_name,
                account_number: profile.account_number,
                balance: profile.balance,
                status: profile.status,
                next_due_date: profile.next_due_date
            },
            statement: {
                total_payments: payments?.length || 0,
                total_amount_paid: payments?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0,
                payments: payments || [],
                invoices: invoices || []
            }
        });
    } catch (e) {
        console.error('[Statement Engine ERRROR]', e.message);
        return res.status(500).json({ error: e.message });
    }
};

// =============================================================================
// UPDATE CUSTOMER
// =============================================================================
exports.updateCustomer = async (req, res) => {
    const { id } = req.params;
    const { profile, service } = req.body;

    try {
        // 1. Fetch current service record
        const { data: existingService, error: fetchErr } = await supabase
            .from('services')
            .select('*, persons(*)')
            .eq('tenant_id', req.tenant_id)
            .eq('id', id)
            .single();

        if (fetchErr || !existingService) return res.status(404).json({ error: 'Service record not found.' });

        // 2. Update Person (Identity)
        const personUpdate = {};
        if (profile?.fullName) personUpdate.full_name = profile.fullName;
        if (profile?.phone)    personUpdate.phone     = profile.phone;
        if (profile?.email)    personUpdate.email     = profile.email;

        if (Object.keys(personUpdate).length > 0) {
            await supabase.from('persons').update(personUpdate).eq('id', existingService.person_id);
        }

        // 3. Update Service (Technical)
        const serviceUpdate = {};
        if (service) {
            if (service.package_id)   serviceUpdate.package_id   = service.package_id;
            if (service.router_id)    serviceUpdate.router_id    = service.router_id;
            if (service.ppp_username) serviceUpdate.username     = service.ppp_username;
            if (service.ip_address)   serviceUpdate.ip_address   = service.ip_address;
            if (service.next_due_date) serviceUpdate.next_due_date = service.next_due_date;
            
            if (service.ppp_password) {
                serviceUpdate.password_encrypted = encrypt(service.ppp_password);
            }
        }

        const { data: updated, error: updateErr } = await supabase
            .from('services')
            .update(serviceUpdate)
            .eq('id', id)
            .eq('tenant_id', req.tenant_id)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // 4. Sync with Router
        if (service?.router_id || service?.ppp_password || service?.package_id) {
            try {
                const { data: pkg } = await supabase.from('packages').select('*').eq('id', updated.package_id).single();
                const profileName = updated.service_type === 'Hotspot' ? pkg.router_hotspot_profile : pkg.router_ppp_profile;
                
                await mikrotikService.provisionUser(
                    req.tenant_id,
                    updated.router_id,
                    {
                        ...updated,
                        full_name: profile?.fullName || existingService.persons?.full_name
                    },
                    updated.service_type,
                    profileName,
                    service.ppp_password || null
                );
            } catch (e) {
                console.warn('[Customer Controller] Router sync failed after edit:', e.message);
            }
        }

        return res.json({ success: true, service: updated });
    } catch (e) {
        console.error('[Update Customer ERROR]', e.message);
        return res.status(500).json({ error: e.message });
    }
};

// =============================================================================
// DELETE CUSTOMER
// =============================================================================
exports.deleteCustomer = async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id)
            .eq('tenant_id', req.tenant_id);

        if (error) throw error;
        return res.json({ success: true, message: 'Service deleted successfully.' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
