import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowUpRight,
  ArrowDownRight,
  User,
  Calendar,
  CreditCard,
  Download,
  MoreHorizontal,
  Plus
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
  LineChart, Line, AreaChart, Area
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
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-[13px] font-medium animate-pulse">Analyzing financial data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Payment Monitoring
          </h2>
          <p className="text-[13px] text-slate-500 mt-1">Real-time financial standing and collection insights.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary py-2 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button className="btn-primary py-2 flex items-center gap-2 shadow-lg shadow-emerald-500/20">
            <Plus className="w-4 h-4" />
            New Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          label="Total Collected" 
          value={`Ksh ${(summary?.total_collected ?? 0).toLocaleString()}`} 
          subValue="This month" 
          icon={<DollarSign className="w-5 h-5" />} 
          color="emerald"
          trend="+12.5%"
        />
        <SummaryCard 
          label="Overdue Balances" 
          value={`Ksh ${(summary?.overdue_amount ?? 0).toLocaleString()}`} 
          subValue={`${summary?.overdue_count} accounts`} 
          icon={<AlertCircle className="w-5 h-5" />} 
          color="rose"
          trend={`${Math.round((summary?.overdue_amount || 0) / (summary?.expected_total || 1) * 100)}% of expected`}
        />
        <SummaryCard 
          label="Partial Pending" 
          value={`Ksh ${(summary?.partial_amount ?? 0).toLocaleString()}`}           subValue={`${summary?.partial_count} accounts`} 
          icon={<Clock className="w-5 h-5" />} 
          color="amber"
        />
        <SummaryCard 
          label="Expected Revenue" 
          value={`Ksh ${(summary?.expected_total ?? 0).toLocaleString()}`}           subValue="Projected this month" 
          icon={<TrendingUp className="w-5 h-5" />} 
          color="indigo"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart: Status Distribution */}
        <div className="card p-6 border-slate-200/60 shadow-sm flex flex-col h-full">
          <h3 className="text-[14px] font-semibold text-slate-800 mb-6 flex items-center gap-2">
            Payment Status Distribution
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full mt-6">
              {distribution.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <div>
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{item.name}</p>
                    <p className="text-[14px] font-bold text-slate-700">{item.pct}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart: Collections */}
        <div className="card p-6 border-slate-200/60 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
              Collections Analysis
            </h3>
            <div className="flex p-1 bg-slate-100 rounded-lg">
              {['day', 'week', 'month'].map(p => (
                <button 
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all ${period === p ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: any) => [`Ksh ${Number(val || 0).toLocaleString()}`, 'Amount']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                  barSize={period === 'day' ? 12 : 32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trend Line Chart */}
      <div className="card p-6 border-slate-200/60 shadow-sm">
        <h3 className="text-[14px] font-semibold text-slate-800 mb-6 flex items-center gap-2">
          30-Day Payment Trend
        </h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#94a3b8' }}
              />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any) => [`Ksh ${Number(val || 0).toLocaleString()}`, 'Collection']}
              />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTrend)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accounts Table Section */}
      <div className="card overflow-hidden border-slate-200/60 shadow-sm">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all ${filter === 'all' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >All Accounts</button>
            <button 
              onClick={() => setFilter('overdue')}
              className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all ${filter === 'overdue' ? 'bg-rose-500 text-white shadow-md' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
            >Overdue</button>
            <button 
              onClick={() => setFilter('partial')}
              className={`px-4 py-1.5 rounded-full text-[12px] font-medium transition-all ${filter === 'partial' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
            >Partial</button>
          </div>

          <form onSubmit={handleSearch} className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search customer, account..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Customer & Account</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Plan & Category</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Payment Details</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Next Due</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-[13px]">
                        {acc.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-700">{acc.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{acc.account}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-[13px] text-slate-600">{acc.package}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${
                        acc.payment_category === 'full' ? 'bg-emerald-100 text-emerald-700' :
                        acc.payment_category === 'discounted' ? 'bg-purple-100 text-purple-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {acc.payment_category}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-emerald-600">Ksh {(acc.amount_paid ?? 0).toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 tracking-tight">paid</span>
                      </div>
                      {acc.balance_due > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-rose-500">Ksh {(acc.balance_due ?? 0).toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 tracking-tight">balance</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-medium">{new Date(acc.next_due_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {acc.balance_due > 0 && acc.balance_due_date && (
                        <div className="flex items-center gap-1.5 mt-1 text-rose-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-tight">Bal due: {new Date(acc.balance_due_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      acc.pay_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      acc.pay_status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        acc.pay_status === 'paid' ? 'bg-emerald-500' :
                        acc.pay_status === 'overdue' ? 'bg-rose-500' :
                        'bg-amber-500'
                      }`} />
                      {acc.pay_status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 group-hover:text-slate-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-40">
                      <Search className="w-10 h-10 mb-2" />
                      <p className="text-[14px] font-medium">No accounts matched your criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <p className="text-[12px] text-slate-500">Showing {accounts.length} results</p>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded border border-slate-200 text-[12px] font-medium hover:bg-white transition" disabled>Previous</button>
            <button className="px-3 py-1.5 rounded border border-slate-200 text-[12px] font-medium hover:bg-white transition" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, subValue, icon, color, trend }: { label: string; value: string; subValue: string; icon: React.ReactNode; color: 'emerald' | 'rose' | 'amber' | 'indigo'; trend?: string }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  return (
    <div className="card p-5 border-slate-200/60 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
            {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <h4 className="text-[22px] font-bold text-slate-800">{value}</h4>
        </div>
        <p className="text-[12px] text-slate-500 mt-0.5">{subValue}</p>
      </div>
    </div>
  );
}
