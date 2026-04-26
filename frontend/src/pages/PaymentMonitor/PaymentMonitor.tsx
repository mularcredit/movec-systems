import React, { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, AlertCircle, Clock, DollarSign, 
  Search, Filter, ChevronRight, ArrowUpRight, ArrowDownRight,
  User, Calendar, CreditCard, Download, MoreHorizontal, Plus, RefreshCw
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { apiFetch } from '../../lib/apiClient';

interface SummaryData {
  total_collected: number;
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
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('day');

  useEffect(() => {
    fetchData();
  }, [filter, period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, distRes, collRes, trendRes, accRes] = await Promise.all([
        apiFetch('/api/payment-monitor/summary').then(r => r.json()),
        apiFetch('/api/payment-monitor/status-distribution').then(r => r.json()),
        apiFetch(`/api/payment-monitor/collections?period=${period}`).then(r => r.json()),
        apiFetch('/api/payment-monitor/trends').then(r => r.json()),
        apiFetch(`/api/payment-monitor/accounts?filter=${filter}&search=${search}`).then(r => r.json()),
      ]);

      setSummary(sumRes.summary);
      setDistribution(distRes.distribution);
      setCollections(collRes.data);
      setTrends(trendRes.trend);
      setAccounts(accRes.accounts);
    } catch (e) {
      console.error('Failed to fetch payment monitor data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  if (loading && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <p className="text-textSecondary text-[13px] font-light">Analyzing financial data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light text-textPrimary tracking-tight flex items-center gap-3">
            Payment Monitoring
          </h2>
          <p className="text-[12px] text-textSecondary mt-1">Real-time financial standing and collection insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-bgSecondary border border-white/5 text-textSecondary px-4 py-2 rounded-xl text-[13px] font-normal hover:bg-white/5 transition-all flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4 text-textSecondary" />
            Export Data
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard 
          label="Total Collected" 
          value={`Ksh ${(summary?.total_collected ?? 0).toLocaleString()}`} 
          subValue="This month" 
          icon={<DollarSign className="w-4 h-4" />} 
          color="emerald"
          trend="+12.5%"
        />
        <SummaryCard 
          label="Overdue Balances" 
          value={`Ksh ${(summary?.overdue_amount ?? 0).toLocaleString()}`} 
          subValue={`${summary?.overdue_count} accounts`} 
          icon={<AlertCircle className="w-4 h-4" />} 
          color="rose"
          trend={`${Math.round((summary?.overdue_amount || 0) / (summary?.expected_total || 1) * 100)}%`}
        />
        <SummaryCard 
          label="Partial Pending" 
          value={`Ksh ${(summary?.partial_amount ?? 0).toLocaleString()}`}           subValue={`${summary?.partial_count} accounts`} 
          icon={<Clock className="w-4 h-4" />} 
          color="amber"
        />
        <SummaryCard 
          label="Expected Revenue" 
          value={`Ksh ${(summary?.expected_total ?? 0).toLocaleString()}`}           subValue="Projected this month" 
          icon={<TrendingUp className="w-4 h-4" />} 
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
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f8fafc" />
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
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f8fafc" />
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
              className={`px-5 py-1.5 rounded-xl text-[12px] font-normal transition-all ${filter === 'overdue' ? 'bg-rose-500 text-white shadow-md' : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100'}`}
            >Overdue</button>
            <button 
              onClick={() => setFilter('partial')}
              className={`px-5 py-1.5 rounded-xl text-[12px] font-normal transition-all ${filter === 'partial' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100'}`}
            >Partial</button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-textSecondary" />
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
            <tbody className="divide-y divide-slate-50">
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
                        acc.payment_category === 'full' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        acc.payment_category === 'discounted' ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                        'bg-amber-50 text-amber-600 border border-amber-100'
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
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-light">{new Date(acc.next_due_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-normal border ${
                      acc.pay_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      acc.pay_status === 'overdue' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
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
                    <button className="p-2 text-textSecondary hover:text-textSecondary transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subValue, icon, color, trend }: { label: string; value: string; subValue: string; icon: React.ReactNode; color: 'emerald' | 'rose' | 'amber' | 'indigo'; trend?: string }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-500 border-emerald-100/50',
    rose: 'bg-rose-50 text-rose-500 border-rose-100/50',
    amber: 'bg-amber-50 text-amber-500 border-amber-100/50',
    indigo: 'bg-indigo-50 text-indigo-500 border-indigo-100/50',
  };

  return (
    <div className="bg-bgSecondary rounded-2xl border border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-500 group">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-xl border ${colors[color]} group-hover:scale-110 transition-transform duration-500`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded-full ${trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-white/5 text-textSecondary'}`}>
            {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
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
