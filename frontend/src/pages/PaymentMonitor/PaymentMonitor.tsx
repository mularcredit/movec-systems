import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAlertCircle, IconArrowDownRight, IconArrowUpRight, IconCalendar, IconCircleCheck, IconClock, IconCreditCard, IconCurrencyDollar, IconDeviceMobile, IconDots, IconDownload, IconHistory, IconPlus, IconSearch, IconTrendingUp, IconUser, IconX } from '@tabler/icons-react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { apiFetch } from '../../lib/apiClient';
import CustomLoader from '../../components/common/CustomLoader';
import { Combobox } from '../../components/ui/Combobox';
import { SelectDropdown } from '../../components/ui/SelectDropdown';
import { supabase } from '../../lib/supabase';

interface SummaryData {
  total_collected: number;
  prev_month_collected: number;
  collected_trend_pct: number | null;
  overdue_count: number;
  overdue_amount: number;
  partial_count: number;
  partial_amount: number;
  expected_total: number;
}

interface DistributionItem {
  name: string;
  value: number;
  color: string;
  pct: number;
}

interface CollectionItem {
  label: string;
  amount: number;
}

interface TrendItem {
  date: string;
  label: string;
  amount: number;
}

interface Account {
  id: string;
  name: string;
  phone: string;
  account: string;
  service_type: string;
  package: string;
  price: number;
  payment_category: string;
  amount_paid: number;
  balance_due: number;
  balance_due_date: string;
  next_due_date: string;
  status: string;
  pay_status: string;
}

export default function PaymentMonitor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('day');
  const [actionOpen, setActionOpen] = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);

  // Inline pay modal state
  const [payModal, setPayModal] = useState({ open: false, loading: false, error: '', success: false, mode: 'stk' as 'stk' | 'manual', customerId: '', amount: '', method: 'M-Pesa', txnCode: '', notes: '', phone: '', prefillCustomerId: '' });
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [filter, period]);

  // Close action dropdown on outside click
  useEffect(() => {
    const close = (e: MouseEvent) => { if (actionRef.current && !actionRef.current.contains(e.target as Node)) setActionOpen(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const fetchCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) return;
    const [legacy, modern] = await Promise.all([
      supabase.from('customers').select('id, full_name, account_number, phone').eq('tenant_id', profile.tenant_id).eq('status', 'active'),
      supabase.from('services').select('id, account_number, status, persons(full_name, phone)').eq('tenant_id', profile.tenant_id).eq('status', 'active')
    ]);
    const combined = [
      ...(legacy.data || []).map((c: any) => ({ id: c.id, full_name: c.full_name, account_number: c.account_number, phone: c.phone })),
      ...(modern.data || []).map((s: any) => ({ id: s.id, full_name: (s.persons as any)?.full_name || 'Unknown', account_number: s.account_number, phone: (s.persons as any)?.phone || '—' }))
    ];
    setCustomers(combined.sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  const fetchData = async (pg = 1) => {
    if (pg === 1) setLoading(true);
    try {
      const [sumRes, distRes, collRes, trendRes, accRes] = await Promise.all([
        apiFetch('/api/payment-monitor/summary').then(r => r.json()),
        apiFetch('/api/payment-monitor/status-distribution').then(r => r.json()),
        apiFetch(`/api/payment-monitor/collections?period=${period}`).then(r => r.json()),
        apiFetch('/api/payment-monitor/trends').then(r => r.json()),
        apiFetch(`/api/payment-monitor/accounts?filter=${filter}&search=${search}&page=${pg}`).then(r => r.json()),
      ]);
      setSummary(sumRes.summary);
      setDistribution(distRes.distribution);
      setCollections(collRes.data);
      setTrends(trendRes.trend);
      if (pg === 1) {
        setAccounts(accRes.accounts || []);
      } else {
        setAccounts(prev => [...prev, ...(accRes.accounts || [])]);
      }
      setHasMore(accRes.hasMore || false);
      setTotalAccounts(accRes.total || 0);
      setPage(pg);
    } catch (e) {
      console.error('Failed to fetch payment monitor data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchData(1); };

  const exportCSV = () => {
    const headers = ['Customer', 'Account', 'Phone', 'Package', 'Paid', 'Balance Due', 'Due Date', 'Status'];
    const rows = accounts.map(a => [a.name, a.account, a.phone, a.package, a.amount_paid, a.balance_due, a.balance_due_date || '—', a.pay_status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `accounts_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const openPayModal = (acc?: Account) => {
    fetchCustomers();
    setPayModal(p => ({ ...p, open: true, error: '', success: false, mode: 'stk', customerId: acc?.id || '', amount: String(acc?.balance_due || ''), method: 'M-Pesa', txnCode: '', notes: '', phone: acc?.phone || '', prefillCustomerId: acc?.id || '' }));
  };

  const submitPayment = async () => {
    if (!payModal.customerId || !payModal.amount) { setPayModal(p => ({ ...p, error: 'Customer and amount required.' })); return; }
    setPayModal(p => ({ ...p, loading: true, error: '' }));
    try {
      const endpoint = payModal.mode === 'stk' ? '/api/mpesa/stk-push' : '/api/mpesa/manual';
      const body = payModal.mode === 'stk'
        ? { customer_id: payModal.customerId, amount: parseFloat(payModal.amount), phone: payModal.phone }
        : { customer_id: payModal.customerId, amount: parseFloat(payModal.amount), method: payModal.method, transaction_code: payModal.txnCode || null, notes: payModal.notes || null };
      const res = await apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPayModal(p => ({ ...p, success: true }));
      setTimeout(() => { setPayModal(p => ({ ...p, open: false })); fetchData(1); }, 2000);
    } catch (e: any) {
      setPayModal(p => ({ ...p, error: e.message }));
    } finally {
      setPayModal(p => ({ ...p, loading: false }));
    }
  };

  const setP = (k: string, v: any) => setPayModal(prev => ({ ...prev, [k]: v }));

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <CustomLoader message="Analyzing financial data..." />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light text-textPrimary tracking-tight">Payment Monitoring</h2>
          <p className="text-[12px] text-textSecondary mt-1">Real-time financial standing and collection insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="bg-bgSecondary border border-white/5 text-textSecondary px-4 py-2 rounded-xl text-[13px] font-normal hover:bg-white/5 transition-all flex items-center gap-2 shadow-sm">
            <IconDownload className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => openPayModal()} className="btn-primary flex items-center gap-2">
            <IconPlus className="w-4 h-4" /> New Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Total Collected" 
          value={`Ksh ${(summary?.total_collected ?? 0).toLocaleString()}`} 
          subValue="This month" 
          icon={<IconCurrencyDollar className="w-4 h-4" />} 
          color="emerald"
          trend={summary?.collected_trend_pct != null ? `${summary.collected_trend_pct > 0 ? '+' : ''}${summary.collected_trend_pct}% vs last month` : undefined}
        />
        <SummaryCard 
          label="Overdue Balances" 
          value={`Ksh ${(summary?.overdue_amount ?? 0).toLocaleString()}`} 
          subValue={`${summary?.overdue_count ?? 0} accounts`} 
          icon={<IconAlertCircle className="w-4 h-4" />} 
          color="rose"
          trend={summary?.expected_total ? `-${Math.round((summary.overdue_amount / summary.expected_total) * 100)}% of expected` : undefined}
          isNegative
        />
        <SummaryCard 
          label="Partial Pending" 
          value={`Ksh ${(summary?.partial_amount ?? 0).toLocaleString()}`}
          subValue={`${summary?.partial_count ?? 0} accounts`} 
          icon={<IconClock className="w-4 h-4" />} 
          color="amber"
        />
        <SummaryCard 
          label="Expected Revenue" 
          value={`Ksh ${(summary?.expected_total ?? 0).toLocaleString()}`}           subValue="Projected this month" 
          icon={<IconTrendingUp className="w-4 h-4" />} 
          color="indigo"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pie Chart: Status Distribution */}
        <div className="bg-bgSecondary rounded-2xl border border-white/5 p-6 shadow-sm flex flex-col h-full">
          <h3 className="text-[14px] font-normal text-textSecondary mb-6 flex items-center gap-2 tracking-tight">
            Distribution
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full mt-8">
              {distribution.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="text-[10px] font-normal text-textSecondary uppercase tracking-widest">{item.name}</p>
                    <p className="text-[16px] font-light text-textPrimary">{item.pct}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart: Collections */}
        <div className="bg-bgSecondary rounded-2xl border border-white/5 p-6 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[14px] font-normal text-textSecondary flex items-center gap-2 tracking-tight">
              Collections Analysis
            </h3>
            <div className="flex p-1 bg-white/5 border border-white/5 rounded-xl">
              {['day', 'week', 'month'].map(p => (
                <button 
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1 rounded-lg text-[11px] font-normal uppercase tracking-wider transition-all ${period === p ? 'bg-bgSecondary text-emerald-600 shadow-sm border border-white/5' : 'text-textSecondary hover:text-textSecondary'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(167,139,250,0.08)" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 300 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 300 }}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#fbfbfd' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }}
                  formatter={(val: any) => [`Ksh ${Number(val || 0).toLocaleString()}`, 'Amount']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#10b981" 
                  opacity={0.7}
                  radius={[4, 4, 0, 0]} 
                  barSize={period === 'day' ? 14 : 36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trend Line Chart */}
      <div className="bg-bgSecondary rounded-2xl border border-white/5 p-6 shadow-sm">
        <h3 className="text-[14px] font-normal text-textSecondary mb-8 flex items-center gap-2 tracking-tight">
          30-Day Payment Trend
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.08}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(167,139,250,0.08)" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 300 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 300 }}
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '12px' }}
                formatter={(val: any) => [`Ksh ${Number(val || 0).toLocaleString()}`, 'Collection']}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#10b981" 
                strokeWidth={1.5}
                fillOpacity={1} 
                fill="url(#colorTrend)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accounts Table Section */}
      <div className="bg-bgSecondary rounded-2xl border border-white/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setFilter('all')}
              className={`px-5 py-1.5 rounded-xl text-[12px] font-normal transition-all ${filter === 'all' ? 'bg-bgPrimary text-white shadow-md' : 'bg-white/5 text-textSecondary hover:bg-white/10 border border-white/5'}`}
            >All Accounts</button>
            <button 
              onClick={() => setFilter('overdue')}
              className={`px-5 py-1.5 rounded-xl text-[12px] font-normal transition-all ${filter === 'overdue' ? 'bg-rose-500 text-white shadow-md' : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'}`}
            >Overdue</button>
            <button 
              onClick={() => setFilter('partial')}
              className={`px-5 py-1.5 rounded-xl text-[12px] font-normal transition-all ${filter === 'partial' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'}`}
            >Partial</button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full md:w-80">
            <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
            <input 
              type="text" 
              placeholder="Find transaction or customer..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-bgSecondary border border-white/5 rounded-2xl text-[13px] focus:outline-none focus:border-emerald-500/30 transition-all placeholder:text-textSecondary"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="px-6 py-4 text-[10px] font-normal text-textSecondary uppercase tracking-[0.1em]">Customer & Account</th>
                <th className="px-6 py-4 text-[10px] font-normal text-textSecondary uppercase tracking-[0.1em]">Plan</th>
                <th className="px-6 py-4 text-[10px] font-normal text-textSecondary uppercase tracking-[0.1em]">Ledger</th>
                <th className="px-6 py-4 text-[10px] font-normal text-textSecondary uppercase tracking-[0.1em]">Due Date</th>
                <th className="px-6 py-4 text-[10px] font-normal text-textSecondary uppercase tracking-[0.1em]">Status</th>
                <th className="px-6 py-4 text-[10px] font-normal text-textSecondary uppercase tracking-[0.1em] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-white/5/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-textSecondary font-normal text-[11px]">
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[13px] font-normal text-textPrimary">{acc.name}</p>
                        <p className="text-[10px] text-textSecondary font-mono mt-0.5 tracking-tight">{acc.account}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div>
                      <p className="text-[12px] text-textSecondary">{acc.package}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-normal uppercase mt-1 tracking-wider ${
                        acc.payment_category === 'full' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                        acc.payment_category === 'discounted' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' :
                        'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}>
                        {acc.payment_category}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <p className="text-[13px] font-light text-textPrimary">Ksh {(acc.amount_paid ?? 0).toLocaleString()}</p>
                      {acc.balance_due > 0 && (
                        <p className="text-[10px] text-rose-400">Bal: Ksh {acc.balance_due.toLocaleString()}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-textSecondary">
                        <IconCalendar className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-light">{new Date(acc.next_due_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-normal border ${
                      acc.pay_status === 'paid' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
                      acc.pay_status === 'overdue' ? 'bg-rose-500/15 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/15 text-amber-400 border-amber-500/20'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        acc.pay_status === 'paid' ? 'bg-emerald-500' :
                        acc.pay_status === 'overdue' ? 'bg-rose-500' :
                        'bg-amber-500'
                      }`} />
                      {acc.pay_status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="relative" ref={actionOpen === acc.id ? actionRef : undefined}>
                      <button
                        onClick={() => setActionOpen(actionOpen === acc.id ? null : acc.id)}
                        className="p-2 text-textSecondary hover:text-textPrimary transition-colors rounded-lg hover:bg-white/5"
                      >
                        <IconDots className="w-4 h-4" />
                      </button>
                      {actionOpen === acc.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-bgSecondary border border-white/10 rounded-xl shadow-xl z-20 py-1 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => { setActionOpen(null); openPayModal(acc); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-textSecondary hover:bg-white/5 hover:text-textPrimary transition-colors"
                          >
                            <IconCurrencyDollar className="w-4 h-4 text-emerald-400" />
                            Record Payment
                          </button>
                          <button
                            onClick={() => { setActionOpen(null); navigate(`/customers/${acc.id}`); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-textSecondary hover:bg-white/5 hover:text-textPrimary transition-colors"
                          >
                            <IconUser className="w-4 h-4 text-blue-400" />
                            View Profile
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="p-4 flex items-center justify-between border-t border-white/5">
            <p className="text-[12px] text-textSecondary">Showing {accounts.length} of {totalAccounts} accounts</p>
            <button
              onClick={() => fetchData(page + 1)}
              className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[12px] text-textSecondary hover:text-textPrimary transition-all"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* Inline Pay Modal */}
      {payModal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[17px] font-medium text-textPrimary">{payModal.mode === 'stk' ? 'Request Mobile Payment' : 'Record Manual Payment'}</h3>
                <p className="text-[12px] text-textSecondary mt-0.5">{payModal.mode === 'stk' ? "Initiate STK Push to customer's phone." : 'Log a cash or external bank payment.'}</p>
              </div>
              <button onClick={() => setP('open', false)} className="text-textSecondary hover:text-textPrimary"><IconX className="w-5 h-5" /></button>
            </div>
            {payModal.success ? (
              <div className="flex flex-col items-center py-8 text-center">
                <IconCircleCheck className="w-14 h-14 text-emerald-500 mb-3" />
                <p className="text-[16px] font-medium text-textPrimary">{payModal.mode === 'stk' ? 'STK Push Sent' : 'Payment Recorded'}</p>
                <p className="text-[13px] text-textSecondary mt-1">{payModal.mode === 'stk' ? 'Ask the customer to enter their PIN.' : 'The ledger has been updated.'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex p-1 bg-white/10 rounded-lg">
                  <button onClick={() => setP('mode', 'stk')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${payModal.mode === 'stk' ? 'bg-bgSecondary text-emerald-400 shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}>
                    <IconDeviceMobile className="w-3.5 h-3.5" /> STK Push
                  </button>
                  <button onClick={() => setP('mode', 'manual')} className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${payModal.mode === 'manual' ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}>
                    <IconHistory className="w-3.5 h-3.5" /> Manual Entry
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Customer *</label>
                  <Combobox value={payModal.customerId} onChange={(v: string) => setP('customerId', v)} options={customers.map(c => ({ label: `${c.full_name} (${c.account_number})`, value: c.id }))} placeholder="Search customer..." />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Amount (KES) *</label>
                  <input type="number" value={payModal.amount} onChange={e => setP('amount', e.target.value)} className="input-field font-mono" placeholder="2500" />
                </div>
                {payModal.mode === 'stk' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Phone</label>
                    <input type="text" value={payModal.phone} onChange={e => setP('phone', e.target.value)} className="input-field font-mono" placeholder="254712345678" />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Method</label>
                    <SelectDropdown value={payModal.method} onChange={(v: string) => setP('method', v)} options={['M-Pesa', 'Cash', 'Bank Transfer', 'Cheque']} />
                  </div>
                )}
                {payModal.error && <div className="p-3 bg-rose-500/15 border border-rose-500/20 rounded-xl text-[12px] text-rose-400">{payModal.error}</div>}
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setP('open', false)} className="flex-1 btn-secondary text-[13px]">Cancel</button>
                  <button onClick={submitPayment} disabled={payModal.loading} className={`flex-1 btn-primary text-[13px] flex items-center justify-center gap-2 ${payModal.mode === 'stk' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                    {payModal.loading ? <CustomLoader inline size="sm" /> : payModal.mode === 'stk' ? 'Send STK Push' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, subValue, icon, color, trend, isNegative }: { label: string; value: string; subValue: string; icon: React.ReactNode; color: 'emerald' | 'rose' | 'amber' | 'indigo'; trend?: string; isNegative?: boolean }) {
  const colors = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  };

  return (
    <div className="bg-bgSecondary rounded-2xl border border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-500 group">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-xl border ${colors[color]} group-hover:scale-110 transition-transform duration-500`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded-full ${
            isNegative ? 'bg-rose-500/15 text-rose-400' : trend.startsWith('+') ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-textSecondary'
          }`}>
            {isNegative ? <IconArrowDownRight className="w-3 h-3" /> : <IconArrowUpRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div className="mt-6">
        <p className="text-[10px] font-normal text-textSecondary uppercase tracking-[0.15em]">{label}</p>
        <h4 className="text-2xl font-light text-textPrimary mt-2 tracking-tight">{value}</h4>
        <p className="text-[12px] text-textSecondary mt-1">{subValue}</p>
      </div>
    </div>
  );
}

