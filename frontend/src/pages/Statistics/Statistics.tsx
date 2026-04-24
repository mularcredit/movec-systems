import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function Statistics() {
  const [collData, setCollData] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ arpu: 0, churn: 0, totalRevenue: 0, activeCount: 0, totalCarryForward: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      // Get the current user's profile to retrieve their tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        console.error("Tenant configuration missing.");
        return;
      }

      const tenantId = profile.tenant_id;
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const { data: payments } = await supabase
        .from('payments')
        .select('amount, paid_at')
        .eq('tenant_id', tenantId) // STRICT ISOLATION
        .gte('paid_at', monthStart);

      if (payments) {
        const dayMap: Record<string, number> = {};
        payments.forEach(p => {
          const day = new Date(p.paid_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
          dayMap[day] = (dayMap[day] || 0) + parseFloat(p.amount);
        });
        setCollData(Object.entries(dayMap).map(([name, amount]) => ({ name, amount })));

        const totalRev = payments.reduce((s, p) => s + parseFloat(p.amount), 0);
        const { data: active }    = await supabase.from('customers').select('id').eq('tenant_id', tenantId).eq('status', 'active');
        const { data: suspended } = await supabase.from('customers').select('id').eq('tenant_id', tenantId).eq('status', 'suspended');
        const activeCount = active?.length || 0;
        const suspCount   = suspended?.length || 0;
        const totalCust   = activeCount + suspCount || 1;

        const { data: legacyCredit } = await supabase.from('customers').select('carry_forward').eq('tenant_id', tenantId);
        const { data: modernCredit } = await supabase.from('services').select('carry_forward').eq('tenant_id', tenantId);
        const totalCredit = [...(legacyCredit || []), ...(modernCredit || [])].reduce((s, c) => s + parseFloat(c.carry_forward || 0), 0);

        setKpis({
          arpu:         Math.round(totalRev / totalCust),
          churn:        parseFloat(((suspCount / totalCust) * 100).toFixed(1)),
          totalRevenue: Math.round(totalRev),
          activeCount,
          totalCarryForward: totalCredit
        });
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-medium text-slate-800">Advanced Analytics</h2>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center"><Calendar className="w-4 h-4 mr-2" /> Last 30 Days</button>
          <button className="btn-primary flex items-center"><TrendingUp className="w-4 h-4 mr-2" /> Export Report</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="card md:col-span-2 flex flex-col p-0">
          <div className="p-5 border-b border-slate-200/60">
            <h3 className="text-[14px] font-medium text-slate-800">Daily Collections Volume</h3>
          </div>
          {collData.length === 0 ? (
            <div className="h-80 w-full flex flex-col items-center justify-center p-10 text-center">
              <BarChart3 className="w-8 h-8 text-slate-300 mb-4" />
              <h3 className="text-[15px] font-medium text-slate-800 mb-1">Waiting on financial data</h3>
              <p className="text-[13px] text-slate-500 max-w-sm">Analytics will populate once the first transactions are recorded.</p>
            </div>
          ) : (
            <div className="h-80 w-full p-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={collData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} />
                  <Area type="monotone" dataKey="amount" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="card space-y-4 bg-[#fbfbfd]">
          <h3 className="text-[14px] font-medium text-slate-800 mb-4">Key Performance Indicators</h3>
          {[
            { label: 'ARPU (This Month)',  value: `Ksh ${kpis.arpu.toLocaleString()}` },
            { label: 'Churn Rate',         value: `${kpis.churn}%`                    },
            { label: 'Monthly Revenue',    value: `Ksh ${kpis.totalRevenue.toLocaleString()}` },
            { label: 'Active Subscribers', value: kpis.activeCount.toString()          },
            { label: 'Total Carry Forward', value: `Ksh ${kpis.totalCarryForward.toLocaleString()}` },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200/60 p-4 rounded-xl shadow-sm">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{k.label}</p>
              <p className="text-[20px] font-medium text-slate-800">{k.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
