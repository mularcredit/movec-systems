import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Users, UserX, AlertTriangle, Clock, Server, CheckCircle2, 
  CreditCard, Wallet, Activity, Zap, ArrowUpRight, Signal
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/apiClient';

const StatCard = ({ title, value, sub, icon: Icon, colorClass, loading, trend }: any) => (
  <div className="bg-bgSecondary rounded-2xl p-5 border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-lg hover:border-white/10 transition-all duration-500 group">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-xl bg-white/5`}>
        <Icon className={`w-4 h-4 ${colorClass}`} strokeWidth={1.5} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-[11px] font-normal ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-90' : ''}`} strokeWidth={2} />
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div>
      <p className="text-[13px] text-textSecondary mb-1">{title}</p>
      {loading ? (
        <div className="w-20 h-7 bg-white/5 rounded animate-pulse"></div>
      ) : (
        <p className="text-2xl font-light text-textPrimary tracking-tight">{value}</p>
      )}
      <p className="text-[11px] text-textSecondary mt-1.5">{sub}</p>
    </div>
  </div>
);

export default function Dashboard() {
  document.title = 'Dashboard | Movec Connect';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeSubscribers: 0,
    suspendedAccounts: 0,
    overduePayments: 0,
    todayCollections: 0,
    monthlyRevenue: 0,
    onlineNodes: 0,
    totalNodes: 0,
    activeSessions: 0,
    globalTraffic: 0
  });
  
  const [revData, setRevData] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfToday = new Date(today.setHours(0,0,0,0)).toISOString();

      const [customers, payments] = await Promise.all([
        supabase.from('customers').select('id, status, next_due_date'),
        supabase.from('payments').select('amount, paid_at').gte('paid_at', startOfMonth)
      ]);

      const custs = customers.data || [];
      const pays = payments.data || [];

      const active = custs.filter(c => c.status === 'active').length;
      const suspended = custs.filter(c => c.status === 'suspended').length;
      const overdue = custs.filter(c => c.status === 'active' && c.next_due_date && new Date(c.next_due_date) < new Date()).length;
      
      const todayColl = pays.filter(p => p.paid_at >= startOfToday).reduce((s, p) => s + Number(p.amount), 0);
      const monthRev = pays.reduce((s, p) => s + Number(p.amount), 0);

      const res = await apiFetch('/api/router/overview');
      const networkData = await res.json();
      
      if (networkData.success) {
        const overview = networkData.overview;
        setStats({
          totalCustomers: custs.length,
          activeSubscribers: active,
          suspendedAccounts: suspended,
          overduePayments: overdue,
          todayCollections: Math.round(todayColl),
          monthlyRevenue: Math.round(monthRev),
          onlineNodes: overview.online_routers,
          totalNodes: overview.total_routers,
          activeSessions: overview.total_active_sessions,
          globalTraffic: Math.round((overview.total_tx_bps + overview.total_rx_bps) / 1000000)
        });
        setRouters(overview.router_metrics);
      }

      setRevData([
        { name: 'Mon', revenue: 4500 }, { name: 'Tue', revenue: 5200 }, { name: 'Wed', revenue: 4800 },
        { name: 'Thu', revenue: 6100 }, { name: 'Fri', revenue: 5900 }, { name: 'Sat', revenue: 7200 },
        { name: 'Sun', revenue: 6800 },
      ]);
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-textSecondary">
      {/* Refined Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-light text-textPrimary tracking-tight">Command center</h1>
          <p className="text-[13px] text-textSecondary mt-1 flex items-center">
            <Activity className="w-3.5 h-3.5 mr-2 text-emerald-400" strokeWidth={1.5} />
            System status: <span className="text-emerald-500/80 ml-1">Optimal performance</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDashboardData} className="p-2.5 bg-bgSecondary border border-white/5 rounded-xl hover:bg-white/5 transition-all shadow-sm">
            <Clock className="w-4 h-4 text-textSecondary" strokeWidth={1.5} />
          </button>
          <button className="bg-bgSecondary text-white px-5 py-2.5 rounded-xl text-[13px] font-normal shadow-sm hover:bg-bgPrimary transition-all flex items-center">
            <Zap className="w-3.5 h-3.5 mr-2 text-amber-400" strokeWidth={1.5} />
            Actions
          </button>
        </div>
      </div>

      {/* Visual Diagram */}
      <div className="flex items-center justify-center py-8 px-4 gap-2 sm:gap-6 bg-[#0B0914]/50 border border-[rgba(167,139,250,0.1)] rounded-2xl mb-8 shadow-inner overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.03)] to-transparent pointer-events-none"></div>

        <div className="flex flex-col items-center relative z-10">
          <img src="/pngwing.com (2).png" alt="Movec Antenna" className="h-16 md:h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(167,139,250,0.4)]" />
          <span className="text-[10px] text-textSecondary mt-3 uppercase tracking-widest font-medium">Movec Hub</span>
        </div>
        
        <div className="flex-1 max-w-[60px] sm:max-w-[120px] h-[2px] bg-white/5 relative overflow-hidden rounded-full">
          <div className="absolute top-0 left-0 h-full w-full animate-data-flow"></div>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <img src="/pngwing.com (1).png" alt="MikroTik Router" className="h-14 md:h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]" />
          <span className="text-[10px] text-textSecondary mt-3 uppercase tracking-widest font-medium">MikroTik Gateway</span>
        </div>

        <div className="flex-1 max-w-[60px] sm:max-w-[120px] h-[2px] bg-white/5 relative overflow-hidden rounded-full">
          <div className="absolute top-0 left-0 h-full w-full animate-data-flow" style={{ animationDelay: '0.5s' }}></div>
        </div>

        <div className="flex flex-col items-center relative z-10">
          <img src="/pngwing.com.png" alt="PPPoE Client" className="h-12 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(96,165,250,0.2)]" />
          <span className="text-[10px] text-textSecondary mt-3 uppercase tracking-widest font-medium">PPPoE Client</span>
        </div>
      </div>

      {/* Grid: 4 Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Today collections" value={`Ksh ${stats.todayCollections.toLocaleString()}`} sub="Direct gateway" icon={Wallet} colorClass="text-emerald-500" loading={loading} trend={12} />
        <StatCard title="Active subscribers" value={stats.activeSubscribers} sub="Authenticated" icon={CheckCircle2} colorClass="text-blue-500" loading={loading} trend={5} />
        <StatCard title="Total bandwidth" value={`${stats.globalTraffic} Mbps`} sub="Real-time flow" icon={Activity} colorClass="text-purple-500" loading={loading} />
        <StatCard title="Network nodes" value={`${stats.onlineNodes}/${stats.totalNodes}`} sub="Gateways active" icon={Server} colorClass={stats.onlineNodes === stats.totalNodes ? "text-emerald-500" : "text-rose-500"} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Refined AreaChart */}
        <div className="lg:col-span-2 bg-bgSecondary rounded-2xl p-6 border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-normal text-textPrimary">Revenue performance</h3>
              <p className="text-[12px] text-textSecondary">Weekly financial analysis</p>
            </div>
            <div className="bg-white/5 p-1 rounded-lg flex gap-1">
              <button className="px-3 py-1 bg-bgSecondary rounded-md text-[11px] font-normal shadow-sm">Income</button>
              <button className="px-3 py-1 text-[11px] font-normal text-textSecondary hover:text-textSecondary transition">Growth</button>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.08}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(167,139,250,0.08)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#C4B5FD', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#C4B5FD', fontSize: 10}} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid rgba(167,139,250,0.2)', background: '#332650', color: '#F3F0FF', fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side column: Refined Revenue Card & Health */}
        <div className="space-y-4">
          <div className="bg-bgPrimary rounded-2xl p-6 text-white relative overflow-hidden group">
             <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <CreditCard className="w-32 h-32" strokeWidth={1} />
             </div>
             <p className="text-textSecondary text-[11px] mb-1">Monthly revenue</p>
             <h3 className="text-3xl font-light text-emerald-400">Ksh {stats.monthlyRevenue.toLocaleString()}</h3>
             
             <div className="mt-8 space-y-3 relative z-10">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-textSecondary">Performance target</span>
                  <span className="text-emerald-400/80">72% Achieved</span>
                </div>
                <div className="w-full h-1 bg-bgSecondary/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/60" style={{ width: '72%' }}></div>
                </div>
                <div className="pt-2 flex items-center justify-between text-[10px] text-textSecondary">
                   <div className="flex -space-x-1.5">
                     {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full border border-white/10 bg-bgSecondary flex items-center justify-center text-[8px]">U{i}</div>)}
                   </div>
                   <span className="text-emerald-500/60">+12% vs last month</span>
                </div>
             </div>
          </div>

          <div className="bg-bgSecondary rounded-2xl p-6 border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
             <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-normal text-textPrimary">Node status</h3>
                <Signal className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
             </div>
             <div className="space-y-4">
                {routers.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                       <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]' : (r.status === 'pending' ? 'bg-amber-400' : 'bg-rose-400')}`}></div>
                       <div>
                          <p className="text-[12px] font-normal text-textPrimary">{r.name}</p>
                          <p className="text-[10px] text-textSecondary">{r.active_sessions} Active | {r.vendor || 'Router'}</p>
                       </div>
                    </div>
                    <span className="text-[11px] text-textSecondary">{r.cpu_load || 0}%</span>
                  </div>
                ))}
                <button className="w-full py-2.5 mt-2 bg-white/5 hover:bg-white/10 rounded-xl text-[11px] font-normal text-textSecondary transition-all">
                  Expand infrastructure
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Alerts: Dark-tinted themed bars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/15 rounded-lg">
               <UserX className="w-4 h-4 text-rose-400" strokeWidth={1.5} />
            </div>
            <div>
               <p className="text-[13px] font-normal text-rose-300">{stats.suspendedAccounts} Suspended accounts</p>
               <p className="text-[11px] text-rose-400/60">Action required</p>
            </div>
         </div>
         <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 rounded-lg">
               <AlertTriangle className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
            </div>
            <div>
               <p className="text-[13px] font-normal text-amber-300">{stats.overduePayments} Overdue invoices</p>
               <p className="text-[11px] text-amber-400/60">Auto-cycle active</p>
            </div>
         </div>
         <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 rounded-lg">
               <Signal className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
            </div>
            <div>
               <p className="text-[13px] font-normal text-blue-300">Starlink stability</p>
               <p className="text-[11px] text-blue-400/60">99.9% WAN uptime</p>
            </div>
         </div>
      </div>
    </div>
  );
}
