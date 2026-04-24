const cron = require('node-cron');
const supabase = require('../utils/supabase');
const { internalSuspendAccount } = require('../controllers/mikrotikController');

/**
 * Scans DB for active customers whose next_due_date is in the past (before today).
 * If found, automatically flags them as suspended and pushes the disable command to their Router.
 */
async function processSuspensions() {
    console.log('[Billing Worker] Checking for expired subscriptions across all tenants...');
    try {
        const today = new Date().toISOString().split('T')[0];

        // 0. Fetch all active tenants
        const { data: tenants, error: tenantErr } = await supabase.from('tenants').select('id');
        if (tenantErr) throw tenantErr;

        for (const tenant of tenants) {

            // ==========================================
            // 1. SCAN LEGACY CUSTOMERS TABLE
            // ==========================================
            const { data: legacyCustomers, error } = await supabase
                .from('customers')
                .select('id, full_name, username, router_id, account_number, next_due_date, tenant_id, package_id, packages(price, grace_days)')
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .lte('next_due_date', today);

            if (error) {
                console.error(`[Billing Worker] Error fetching legacy customers for Tenant ${tenant.id}:`, error.message);
            }

            if (legacyCustomers && legacyCustomers.length > 0) {
                for (const customer of legacyCustomers) {
                    if (today >= customer.next_due_date) {

                        // 1a. INVOICE GENERATION ENGINE
                        try {
                            const { data: invCheck } = await supabase.from('invoices').select('id')
                                .eq('tenant_id', tenant.id).eq('customer_id', customer.id).eq('due_date', customer.next_due_date);

                            if (!invCheck || invCheck.length === 0) {
                                await supabase.from('invoices').insert([{
                                    tenant_id: tenant.id,
                                    customer_id: customer.id,
                                    service_id: null,
                                    amount_due: customer.packages?.price || 0,
                                    due_date: customer.next_due_date,
                                    status: 'unpaid',
                                    notes: 'System Generated Cycle Invoice'
                                }]);
                                console.log(`[Billing Worker] [Tenant: ${tenant.id}] Generated Invoice for Account ${customer.account_number} targeting ${customer.next_due_date}`);
                            }
                        } catch (invErr) {
                            console.error(`[Billing Worker] Invoice Error for ${customer.account_number}:`, invErr.message);
                        }

                        // 1b. SUSPENSION ENGINE (Factoring Grace Days)
                        const grace = customer.packages?.grace_days || 0;
                        const offsetDueDate = new Date(customer.next_due_date);
                        offsetDueDate.setDate(offsetDueDate.getDate() + grace);
                        const offsetDueDateStr = offsetDueDate.toISOString().split('T')[0];

                        if (today > offsetDueDateStr) {
                            try {
                                if (customer.router_id && customer.username) {
                                    await internalSuspendAccount(tenant.id, customer.router_id, customer.username);
                                }

                                await supabase.from('customers').update({ status: 'suspended' }).eq('tenant_id', tenant.id).eq('id', customer.id);

                                await supabase.from('suspensions').insert([{
                                    tenant_id: tenant.id,
                                    customer_id: customer.id,
                                    reason: `Automated suspension: Due date ${customer.next_due_date} elapsed (grace: ${grace} days).`,
                                }]);

                                console.log(`[Billing Worker] [Tenant: ${tenant.id}] Suspended Legacy Account ${customer.account_number} (${customer.username})`);
                            } catch (err) {
                                console.error(`[Billing Worker] [Tenant: ${tenant.id}] Failed to suspend legacy account ${customer.account_number}:`, err.message);
                            }
                        }
                    }
                }
            }

            // ==========================================
            // 2. SCAN NEW ENTERPRISE SERVICES TABLE
            // ==========================================
            const { data: expiredServices, error: srvErr } = await supabase
                .from('services')
                .select('id, person_id, username, router_id, account_number, next_due_date, tenant_id, package_id, packages(price, grace_days)')
                .eq('tenant_id', tenant.id)
                .eq('status', 'active')
                .lte('next_due_date', today);

            if (srvErr) {
                console.error(`[Billing Worker] Error fetching services for Tenant ${tenant.id}:`, srvErr.message);
            }

            if (expiredServices && expiredServices.length > 0) {
                for (const service of expiredServices) {
                    if (today >= service.next_due_date) {

                        // 2a. INVOICE GENERATION ENGINE
                        try {
                            const { data: invCheck } = await supabase.from('invoices').select('id')
                                .eq('tenant_id', tenant.id).eq('service_id', service.id).eq('due_date', service.next_due_date);

                            if (!invCheck || invCheck.length === 0) {
                                await supabase.from('invoices').insert([{
                                    tenant_id: tenant.id,
                                    customer_id: null,
                                    service_id: service.id,
                                    amount_due: service.packages?.price || 0,
                                    due_date: service.next_due_date,
                                    status: 'unpaid',
                                    notes: 'System Generated Cycle Invoice'
                                }]);
                                console.log(`[Billing Worker] [Tenant: ${tenant.id}] Generated Invoice for Service ${service.account_number} targeting ${service.next_due_date}`);
                            }
                        } catch (invErr) {
                            console.error(`[Billing Worker] Invoice Error for ${service.account_number}:`, invErr.message);
                        }

                        // 2b. SUSPENSION ENGINE
                        const grace = service.packages?.grace_days || 0;
                        const offsetDueDate = new Date(service.next_due_date);
                        offsetDueDate.setDate(offsetDueDate.getDate() + grace);
                        const offsetDueDateStr = offsetDueDate.toISOString().split('T')[0];

                        if (today > offsetDueDateStr) {
                            try {
                                if (service.router_id && service.username) {
                                    await internalSuspendAccount(tenant.id, service.router_id, service.username);
                                }

                                await supabase.from('services').update({ status: 'suspended' }).eq('tenant_id', tenant.id).eq('id', service.id);

                                await supabase.from('suspensions').insert([{
                                    tenant_id: tenant.id,
                                    customer_id: null,
                                    reason: `Automated suspension: Due date ${service.next_due_date} elapsed (grace: ${grace} days).`,
                                }]);

                                console.log(`[Billing Worker] [Tenant: ${tenant.id}] Suspended Enterprise Service ${service.account_number} (${service.username})`);
                            } catch (err) {
                                console.error(`[Billing Worker] [Tenant: ${tenant.id}] Failed to suspend enterprise service ${service.account_number}:`, err.message);
                            }
                        }
                    }
                }
            }

        } // end for (tenant of tenants)

    } catch (e) {
        console.error('[Billing Worker] Critical error in suspension cycle:', e.message);
    }
}

function start() {
    console.log('[Billing Worker] Automated Billing Sync initialized.');
    // Run the job at the top of every hour (e.g. 01:00, 02:00, etc.)
    // If you prefer midnight only, change to '0 0 * * *'
    cron.schedule('0 * * * *', processSuspensions);

    // Also run immediately on boot for any missed crons during downtime
    processSuspensions();
}

module.exports = { start, processSuspensions };
