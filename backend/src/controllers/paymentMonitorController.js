const supabase = require('../utils/supabase');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ─────────────────────────────────────────────────────────────
// SUMMARY CARDS
// ─────────────────────────────────────────────────────────────
exports.getSummary = async (req, res) => {
    try {
        const now = new Date();
        const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
        const today = now.toISOString().split('T')[0];

        const [paymentsRes, prevMonthRes, servicesRes] = await Promise.all([
            supabase.from('payments').select('amount').eq('tenant_id', req.tenant_id).gte('paid_at', monthStart),
            supabase.from('payments').select('amount').eq('tenant_id', req.tenant_id).gte('paid_at', prevMonthStart).lte('paid_at', prevMonthEnd),
            supabase.from('services').select('payment_category, balance_due, balance_due_date, next_due_date, packages(price)').eq('tenant_id', req.tenant_id).not('status', 'eq', 'cancelled')
        ]);

        const payments      = paymentsRes.data  || [];
        const prevPayments  = prevMonthRes.data  || [];
        const services      = servicesRes.data   || [];

        const totalCollected     = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const prevMonthCollected = prevPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

        // Real month-over-month trend %
        let collectedTrendPct = null;
        if (prevMonthCollected > 0) {
            collectedTrendPct = Math.round(((totalCollected - prevMonthCollected) / prevMonthCollected) * 100);
        }

        let overdueCount  = 0, overdueAmount = 0;
        let partialCount  = 0, partialAmount = 0;
        let expectedTotal = 0;

        for (const s of services) {
            const price = parseFloat(s.packages?.price || 0);
            expectedTotal += price;

            if (s.balance_due > 0 && s.balance_due_date && s.balance_due_date < today) {
                overdueCount++;
                overdueAmount += parseFloat(s.balance_due);
            } else if (s.balance_due > 0) {
                partialCount++;
                partialAmount += parseFloat(s.balance_due);
            }
        }

        res.json({
            success: true,
            summary: {
                total_collected:      totalCollected,
                prev_month_collected: prevMonthCollected,
                collected_trend_pct:  collectedTrendPct,
                overdue_count:        overdueCount,
                overdue_amount:       overdueAmount,
                partial_count:        partialCount,
                partial_amount:       partialAmount,
                expected_total:       expectedTotal,
            }
        });
    } catch (e) {
        console.error('[PaymentMonitor] getSummary error:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// ─────────────────────────────────────────────────────────────
// PIE CHART — STATUS DISTRIBUTION
// ─────────────────────────────────────────────────────────────
exports.getStatusDistribution = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data: services } = await supabase
            .from('services')
            .select('payment_category, balance_due, balance_due_date, next_due_date, status')
            .eq('tenant_id', req.tenant_id)
            .not('status', 'eq', 'cancelled');

        const counts = { paid: 0, partial: 0, overdue: 0, unpaid: 0 };

        for (const s of (services || [])) {
            if (s.payment_category === 'already_paid' || (s.payment_category === 'full' && s.balance_due === 0)) {
                counts.paid++;
            } else if (s.balance_due > 0 && s.balance_due_date && s.balance_due_date < today) {
                counts.overdue++;
            } else if (s.balance_due > 0) {
                counts.partial++;
            } else if (s.next_due_date && s.next_due_date < today && s.payment_category !== 'already_paid') {
                counts.overdue++;
            } else {
                counts.paid++;
            }
        }

        const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

        res.json({
            success: true,
            distribution: [
                { name: 'Paid',    value: counts.paid,    color: '#10b981', pct: Math.round(counts.paid    / total * 100) },
                { name: 'Partial', value: counts.partial, color: '#f59e0b', pct: Math.round(counts.partial / total * 100) },
                { name: 'Overdue', value: counts.overdue, color: '#ef4444', pct: Math.round(counts.overdue / total * 100) },
                { name: 'Unpaid',  value: counts.unpaid,  color: '#94a3b8', pct: Math.round(counts.unpaid  / total * 100) },
            ]
        });
    } catch (e) {
        console.error('[PaymentMonitor] getStatusDistribution error:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// ─────────────────────────────────────────────────────────────
// BAR CHART — COLLECTIONS BY PERIOD
// ─────────────────────────────────────────────────────────────
exports.getCollections = async (req, res) => {
    try {
        const period = req.query.period || 'day'; // 'day' | 'week' | 'month'
        const now = new Date();
        let from, groups;

        if (period === 'day') {
            from = new Date(now); from.setDate(from.getDate() - 29);
            groups = Array.from({ length: 30 }, (_, i) => {
                const d = addDays(from, i);
                return { key: d.toISOString().split('T')[0], label: `${d.getDate()}/${d.getMonth() + 1}` };
            });
        } else if (period === 'week') {
            from = new Date(now); from.setDate(from.getDate() - 83);
            groups = Array.from({ length: 12 }, (_, i) => {
                const start = addDays(from, i * 7);
                return { key: start.toISOString().split('T')[0], label: `Wk ${i + 1}` };
            });
        } else {
            // month
            groups = Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
                return {
                    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    label: d.toLocaleString('default', { month: 'short' })
                };
            });
            from = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        }

        const { data: payments } = await supabase
            .from('payments')
            .select('amount, paid_at')
            .eq('tenant_id', req.tenant_id)
            .gte('paid_at', from.toISOString())
            .order('paid_at');

        const totals = {};
        for (const g of groups) totals[g.key] = 0;

        for (const p of (payments || [])) {
            const d = new Date(p.paid_at);
            let key;
            if (period === 'day') {
                key = d.toISOString().split('T')[0];
            } else if (period === 'week') {
                // Find which bucket
                const diffDays = Math.floor((d - from) / 86400000);
                const weekIdx  = Math.floor(diffDays / 7);
                key = groups[weekIdx] ? groups[weekIdx].key : null;
            } else {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
            if (key && totals[key] !== undefined) totals[key] += parseFloat(p.amount || 0);
        }

        const data = groups.map(g => ({ label: g.label, amount: Math.round(totals[g.key] || 0) }));

        res.json({ success: true, data, period });
    } catch (e) {
        console.error('[PaymentMonitor] getCollections error:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// ─────────────────────────────────────────────────────────────
// LINE CHART — 30-DAY TREND
// ─────────────────────────────────────────────────────────────
exports.getTrends = async (req, res) => {
    try {
        const now  = new Date();
        const from = new Date(now); from.setDate(from.getDate() - 29);

        const { data: payments } = await supabase
            .from('payments')
            .select('amount, paid_at')
            .eq('tenant_id', req.tenant_id)
            .gte('paid_at', from.toISOString())
            .order('paid_at');

        const dailyMap = {};
        for (let i = 0; i < 30; i++) {
            const d = addDays(from, i);
            const key = d.toISOString().split('T')[0];
            dailyMap[key] = 0;
        }

        for (const p of (payments || [])) {
            const key = new Date(p.paid_at).toISOString().split('T')[0];
            if (dailyMap[key] !== undefined) dailyMap[key] += parseFloat(p.amount || 0);
        }

        const trend = Object.entries(dailyMap).map(([date, amount]) => ({
            date,
            label: new Date(date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }),
            amount: Math.round(amount)
        }));

        res.json({ success: true, trend });
    } catch (e) {
        console.error('[PaymentMonitor] getTrends error:', e.message);
        res.status(500).json({ error: e.message });
    }
};

// ─────────────────────────────────────────────────────────────
// ACCOUNTS TABLE
// ─────────────────────────────────────────────────────────────
exports.getAccounts = async (req, res) => {
    try {
        const today  = new Date().toISOString().split('T')[0];
        const filter = req.query.filter || 'all';
        const search = (req.query.search || '').toLowerCase();
        const page   = parseInt(req.query.page || '1');
        const limit  = 50;

        // Fetch a large batch then filter in JS (Supabase doesn't let us filter on joined column)
        // Use a high range to avoid pagination cutting into filter results
        const { data: services, error, count } = await supabase
            .from('services')
            .select(`
                id, account_number, service_type, status,
                payment_category, amount_paid, discount_amount, balance_due, balance_due_date,
                next_due_date, created_at,
                persons(full_name, phone),
                packages(display_name, price)
            `, { count: 'exact' })
            .eq('tenant_id', req.tenant_id)
            .not('status', 'eq', 'cancelled')
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        let rows = (services || []).map(s => {
            const name    = s.persons ? s.persons.full_name : '—';
            const phone   = s.persons ? s.persons.phone : '—';
            const pkg     = s.packages ? s.packages.display_name : '—';
            const price   = parseFloat(s.packages ? s.packages.price : 0);
            const balDue  = parseFloat(s.balance_due || 0);
            const dueDate = s.balance_due_date;

            let payStatus;
            if (s.payment_category === 'already_paid') payStatus = 'paid';
            else if (balDue > 0 && dueDate && dueDate < today) payStatus = 'overdue';
            else if (balDue > 0) payStatus = 'partial';
            else if (s.next_due_date && s.next_due_date < today) payStatus = 'overdue';
            else payStatus = 'paid';

            return {
                id: s.id,
                name, phone, account: s.account_number,
                service_type: s.service_type,
                package: pkg, price,
                payment_category: s.payment_category || 'full',
                amount_paid: parseFloat(s.amount_paid || 0),
                discount_amount: parseFloat(s.discount_amount || 0),
                balance_due: balDue,
                balance_due_date: dueDate,
                next_due_date: s.next_due_date,
                status: s.status,
                pay_status: payStatus
            };
        });

        // Apply filter BEFORE pagination
        if (filter !== 'all') rows = rows.filter(r => r.pay_status === filter);

        // Apply search BEFORE pagination
        if (search) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(search) ||
                r.account.toLowerCase().includes(search) ||
                r.phone.toLowerCase().includes(search)
            );
        }

        const total = rows.length;

        // Paginate AFTER filter+search
        const paginated = rows.slice((page - 1) * limit, page * limit);

        res.json({ success: true, accounts: paginated, total, page, hasMore: page * limit < total });
    } catch (e) {
        console.error('[PaymentMonitor] getAccounts error:', e.message);
        res.status(500).json({ error: e.message });
    }
};
