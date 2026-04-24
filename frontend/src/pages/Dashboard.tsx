import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Users, UserX, AlertTriangle, Clock, Server, CheckCircle2, 
  XOctagon, CreditCard, Wallet, Calendar, ArrowUpRight, Activity
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/apiClient';

const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#6366f1'];

const StatCard = ({ title, value, sub, icon: Icon, colorClass, loading }: any) => (
  <div className="card card-hover flex flex-col justify-between group cursor-pointer">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-slate-500 font-medium text-[13px] tracking-wide">{title}</h3>
      <Icon className={`w-4 h-4 text-slate-400 group-hover:${colorClass} transition-colors`} />
    </div>
    <div>
      {loading ? (
        <div className="w-16 h-8 bg-slate-100 rounded animate-pulse"></div>
      ) : (
        <p className="text-2xl font-medium text-slate-800 tracking-tight">{value}</p>
      )}
      <div className="flex items-center mt-2">
         <span className={`text-[12px] font-medium ${colorClass}`}>{sub}</span>
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  document.title = 'Movec Connect | ISP Dashboard';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0, active: 0, suspended: 0, 
    collections: 0, monthlyRev: 0,
    routers: 0, online: 0, offline: 0,
    overdue: 0, expiring: 0
  });
  
  const [revData, setRevData] = useState<any[]>([]);
  const [packageData, setPackageData] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [routersList, setRoutersList] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Get the current user's profile to retrieve their tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        console.error("Tenant configuration missing.");
        setLoading(false);
        return;
      }

      const tenantId = profile.tenant_id;

      // Customer stats — STRICT ISOLATION
      const { data: custData } = await supabase.from('customers')
        .select('status, next_due_date')
        .eq('tenant_id', tenantId);
      const today = new Date();
      const in3Days = new Date(); in3Days.setDate(today.getDate() + 3);
      const activeCount = custData?.filter((c: any) => c.status === 'active').length || 0;
      const suspCount = custData?.filter((c: any) => c.status === 'suspended').length || 0;
      const overdueCount = custData?.filter((c: any) => c.next_due_date && new Date(c.next_due_date) < today && c.status === 'active').length || 0;
      const expiringCount = custData?.filter((c: any) => {
        const due = c.next_due_date ? new Date(c.next_due_date) : null;
        return due && due >= today && due <= in3Days;
      }).length || 0;

      // Payments — today's collections & this month's revenue
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfToday = new Date(today.setHours(0,0,0,0)).toISOString();
      const { data: payData } = await supabase.from('payments')
        .select('amount, transaction_code, method, paid_at, customers(full_name)')
        .eq('tenant_id', tenantId) // STRICT ISOLATION
        .order('paid_at', { ascending: false });
      
      const todayTotal = payData?.filter((p: any) => p.paid_at >= startOfToday)
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;
      const monthTotal = payData?.filter((p: any) => p.paid_at >= startOfMonth)
        .reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0) || 0;

      // Routers from API
      const resRouters = await apiFetch('/api/router');
      const routerData = await resRouters.json();
      const nodes = routerData.success ? routerData.routers : [];
      const onlineNodes = nodes.filter((n: any) => n.connection_status === 'online').length;

      setStats({
        customers: custData?.length || 0,
        active: activeCount,
        suspended: suspCount,
        collections: Math.round(todayTotal),
        monthlyRev: Math.round(monthTotal),
        routers: nodes.length,
        online: onlineNodes,
        offline: nodes.length - onlineNodes,
        overdue: overdueCount,
        expiring: expiringCount
      });
      
      setPayments((payData || []).slice(0, 5));
      setRoutersList(nodes || []);
      setRevData([]);
      setPackageData([]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <h2 className="text-xl font-medium text-slate-800">Quick Operations Metrics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Row 1: Customers */}
        <StatCard title="Total Customers" value={stats.customers} sub="Registered globally" icon={Users} colorClass="text-blue-600" bgClass="bg-blue-100" loading={loading} />
        <StatCard title="Active Customers" value={stats.active} sub="Active sessions permitted" icon={CheckCircle2} colorClass="text-emerald-600" bgClass="bg-emerald-100" loading={loading} />
        <StatCard title="Suspended" value={stats.suspended} sub="Needs Follow-up" icon={UserX} colorClass="text-rose-600" bgClass="bg-rose-100" loading={loading} />
        <StatCard title="Overdue Accounts" value={stats.overdue} sub="Past grace period" icon={AlertTriangle} colorClass="text-amber-600" bgClass="bg-amber-100" loading={loading} />
        <StatCard title="Expiring Soon" value={stats.expiring} sub="Next 3 days" icon={Clock} colorClass="text-purple-600" bgClass="bg-purple-100" loading={loading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Row 2: Revenue & Infrastructure */}
        <StatCard title="Today Collections" value={`Ksh ${stats.collections}`} sub="via Gateway" icon={Wallet} colorClass="text-emerald-600" bgClass="bg-emerald-100" loading={loading} />
        <StatCard title="Monthly Revenue" value={`Ksh ${stats.monthlyRev}`} sub="Current Cycle" icon={CreditCard} colorClass="text-emerald-600" bgClass="bg-emerald-100" loading={loading} />
        <StatCard title="Total Routers" value={stats.routers} sub="Linked Gateways" icon={Server} colorClass="text-slate-600" bgClass="bg-slate-200" loading={loading} />
        <StatCard title="Online Nodes" value={stats.online} sub="Live Pings" icon={Activity} colorClass="text-blue-600" bgClass="bg-blue-100" loading={loading} />
        <StatCard title="Offline Nodes" value={stats.offline} sub="Down Alerts" icon={XOctagon} colorClass="text-rose-600" bgClass="bg-rose-100" loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* Revenue Area Chart */}
        <div className="card lg:col-span-2 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-medium text-slate-800">Monthly Revenue Trend</h3>
          </div>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} width={80} tickFormatter={(value) => `Ksh ${value/1000}k`} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Package Distribution Radial */}
        <div className="card flex flex-col h-[400px]">
          <h3 className="text-lg font-medium text-slate-800 mb-2">Package Distribution</h3>
          <p className="text-sm text-slate-500 mb-6">Current active subscriptions by speed</p>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={packageData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5} dataKey="value">
                  {packageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Payments Matrix */}
        <div className="card p-0 flex flex-col">
          <div className="p-5 border-b border-slate-200/60 flex justify-between items-center">
            <h3 className="text-[14px] font-medium text-slate-800">Recent Transactions</h3>
          </div>
          <div className="flex-1">
            {payments.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center p-10">
                 <Wallet className="w-8 h-8 text-slate-300 mb-3" />
                 <p className="text-[13px] text-slate-500 font-medium">No transactions recorded yet.</p>
               </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <tbody className="divide-y divide-slate-100">
                  {payments.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors duration-150">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800 text-[13px]">{p.customers?.full_name || 'System Auto'}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.transaction_code || 'MANUAL-REC'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <p className="font-medium text-emerald-600 text-[13px]">Ksh {p.amount}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{new Date(p.paid_at).toLocaleDateString()}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {payments.length > 0 && <button className="w-full text-center p-3 text-[12px] font-medium text-emerald-600 hover:bg-slate-50 border-t border-slate-100 transition-colors">View All Payments</button>}
        </div>

        {/* Realtime Router Health */}
        <div className="card p-0 flex flex-col">
          <div className="p-5 border-b border-slate-200/60">
            <h3 className="text-[14px] font-medium text-slate-800">Network Health Summary</h3>
          </div>
          <div className="flex-1 p-5">
            {routersList.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                 <Server className="w-8 h-8 text-slate-300 mb-3" />
                 <p className="text-[13px] text-slate-500 font-medium mb-3">No active nodes connected to the platform.</p>
                 <a href="/network/routers/add" className="text-[12px] font-medium text-emerald-600 hover:text-emerald-700">Link a Gateway Node &rarr;</a>
               </div>
            ) : (
               <div className="space-y-6">
                 {routersList.map((router, i) => (
                   <div key={i}>
                      <div className="flex justify-between items-center mb-2.5">
                         <div className="flex items-center">
                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${router.connection_status === 'online' ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                            <p className="text-[13px] font-medium text-slate-700">{router.name}</p>
                         </div>
                         <span className={`text-[11px] font-medium ${router.connection_status === 'online' ? 'text-emerald-600' : 'text-slate-400'}`}>
                           {router.connection_status === 'online' ? 'Tunnel Active' : 'Offline'}
                         </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 ${router.connection_status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{width: router.connection_status === 'online' ? '100%' : '0%'}}></div>
                      </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
