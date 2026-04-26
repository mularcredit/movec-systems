import React, { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  Activity, Server, Users, Signal, 
  Clock, Globe, AlertCircle,
  ArrowUp, ArrowDown, RefreshCw
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

const MetricCard = ({ title, value, unit, icon: Icon, colorClass, trend }: any) => (
  <div className="bg-bgSecondary border border-white/5 p-5 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-lg transition-all duration-500 group">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-xl bg-white/5`}>
        <Icon className={`w-4 h-4 ${colorClass}`} strokeWidth={1.5} />
      </div>
      {trend && (
        <span className={`text-[11px] font-normal px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-[13px] text-textSecondary mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-2xl font-light text-textPrimary tracking-tight">{value}</p>
        <p className="text-[13px] text-textSecondary">{unit}</p>
      </div>
    </div>
  </div>
);

export default function Statistics() {
  document.title = 'Network Dashboard | Movec Connect';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [trafficHistory, setTrafficHistory] = useState<any[]>([]);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const fetchNetworkData = useCallback(async () => {
    try {
      setError(null);
      const [overviewRes, sessionsRes] = await Promise.all([
        apiFetch('/api/router/overview'),
        apiFetch('/api/router/sessions/all')
      ]);
      
      if (!overviewRes.ok || !sessionsRes.ok) {
        throw new Error('Synchronization failure');
      }

      const overviewData = await overviewRes.json();
      const sessionsData = await sessionsRes.json();

      if (overviewData.success) {
        setOverview(overviewData.overview);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newPoint = {
          time: timestamp,
          tx: Math.round(overviewData.overview.total_tx_bps / 1000000 * 100) / 100,
          rx: Math.round(overviewData.overview.total_rx_bps / 1000000 * 100) / 100
        };
        setTrafficHistory(prev => [...prev, newPoint].slice(-20));
      }

      if (sessionsData.success) {
        setActiveSessions(sessionsData.sessions || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworkData();
    const interval = setInterval(fetchNetworkData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchNetworkData, refreshInterval]);

  if (error && !overview) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-4 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-rose-200" strokeWidth={1} />
        <div>
          <h3 className="text-lg font-light text-textPrimary">Synchronization failed</h3>
          <p className="text-[13px] text-textSecondary mt-1 max-w-xs">{error}</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchNetworkData(); }}
          className="bg-bgSecondary text-white px-6 py-2.5 rounded-xl text-[13px] font-normal hover:bg-bgPrimary transition-all flex items-center"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-2" />
          Retry connection
        </button>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-6 h-6 text-white/30 animate-spin" strokeWidth={1.5} />
        <p className="text-textSecondary text-[13px] font-light">Synchronizing infrastructure...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans text-textSecondary">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-light text-textPrimary tracking-tight">Live network intelligence</h1>
          <p className="text-[13px] text-textSecondary mt-1 flex items-center">
            <Globe className="w-3.5 h-3.5 mr-2 text-blue-400/70" strokeWidth={1.5} />
            Monitoring {overview?.total_routers} gateway nodes
          </p>
        </div>
        <div className="flex items-center gap-2">
           <div className="bg-bgSecondary border border-white/5 px-3 py-1.5 rounded-xl flex items-center gap-3 shadow-sm">
              <span className="flex h-1.5 w-1.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-textSecondary">Live feed</span>
              <div className="h-3 w-px bg-white/10"></div>
              <select 
                className="text-[11px] text-textSecondary bg-transparent border-none focus:ring-0 cursor-pointer p-0 pr-4"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
              >
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
              </select>
           </div>
        </div>
      </div>

      {/* Grid: 4 Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Active sessions" value={overview?.total_active_sessions || 0} unit="Subscribers" icon={Users} colorClass="text-blue-500" />
        <MetricCard title="Traffic (download)" value={(overview?.total_rx_bps / 1000000).toFixed(1)} unit="Mbps" icon={ArrowDown} colorClass="text-emerald-500" />
        <MetricCard title="Traffic (upload)" value={(overview?.total_tx_bps / 1000000).toFixed(1)} unit="Mbps" icon={ArrowUp} colorClass="text-blue-400" />
        <MetricCard title="Network stability" value={overview?.online_routers > 0 ? "Stable" : "Offline"} unit={overview?.online_routers === overview?.total_routers ? "All nodes up" : "Partial outage"} icon={Activity} colorClass={overview?.online_routers === overview?.total_routers ? "text-emerald-500" : "text-rose-500"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bandwidth Trend */}
        <div className="lg:col-span-2 bg-bgSecondary rounded-2xl p-6 border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-normal text-textPrimary">Aggregate bandwidth</h3>
              <p className="text-[12px] text-textSecondary">Real-time throughput distribution</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <span className="text-[11px] text-textSecondary">Download</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-[11px] text-textSecondary">Upload</span>
              </div>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <defs>
                  <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.08}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.08}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f8fafc" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#cbd5e1', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#cbd5e1', fontSize: 10}} unit="M" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="rx" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRx)" />
                <Area type="monotone" dataKey="tx" stroke="#3b82f6" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTx)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Node Health Matrix */}
        <div className="space-y-4">
          <div className="bg-bgPrimary rounded-2xl p-6 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Activity className="w-24 h-24" strokeWidth={1} />
            </div>
            <h3 className="text-sm font-normal mb-6 flex items-center text-textSecondary">
              Node health matrix
            </h3>
            <div className="space-y-3 relative z-10">
              {overview?.router_metrics.map((router: any) => (
                <div key={router.id} className="p-3.5 bg-bgSecondary/5 border border-white/5 rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-normal text-[13px] text-white/30">{router.name}</span>
                    <span className={`text-[10px] ${router.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {router.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-textSecondary">CPU</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-0.5 bg-bgSecondary/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500/60" style={{ width: `${router.cpu_load}%` }}></div>
                        </div>
                        <span className="text-[11px] text-textSecondary">{router.cpu_load}%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-textSecondary">Sessions</p>
                      <p className="text-[13px] font-light">{router.active_sessions}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/10">
            <h3 className="text-sm font-normal mb-4 flex items-center opacity-80">
              WAN Integrity
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-blue-100 opacity-60">Status</p>
                <p className="text-xl font-light mt-0.5">Optimal</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-blue-100 opacity-60">Latency</p>
                <p className="text-xl font-light mt-0.5">32ms</p>
              </div>
            </div>
            <div className="mt-6 flex gap-1 h-6">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="flex-1 bg-bgSecondary/10 rounded-sm flex flex-col justify-end">
                   <div className="w-full bg-bgSecondary/40" style={{ height: `${40 + Math.random() * 60}%` }}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Sessions Table */}
      <div className="bg-bgSecondary rounded-2xl border border-white/5 shadow-[0_1px_2px_rgba(0,0,0,0.01)] overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-normal text-textPrimary">Live traffic streams</h3>
            <p className="text-[12px] text-textSecondary mt-0.5">Real-time session telemetry</p>
          </div>
          <button 
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-normal text-textSecondary transition-all"
            onClick={fetchNetworkData}
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5/30">
                <th className="px-6 py-3 text-[10px] text-textSecondary font-normal">Subscriber</th>
                <th className="px-6 py-3 text-[10px] text-textSecondary font-normal">Protocol</th>
                <th className="px-6 py-3 text-[10px] text-textSecondary font-normal">Address</th>
                <th className="px-6 py-3 text-[10px] text-textSecondary font-normal">Gateway</th>
                <th className="px-6 py-3 text-[10px] text-textSecondary font-normal">Uptime</th>
                <th className="px-6 py-3 text-[10px] text-textSecondary font-normal text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-textSecondary text-[12px] font-light">
                    Waiting for session telemetry...
                  </td>
                </tr>
              ) : activeSessions.map((session, idx) => (
                <tr key={idx} className="hover:bg-white/5/30 transition-all duration-300">
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-normal text-textPrimary">{session.username}</p>
                    <p className="text-[10px] text-textSecondary font-mono opacity-60">{session.caller_id || session.mac}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] text-textSecondary border border-white/5 px-1.5 py-0.5 rounded">
                      {session.service}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-textSecondary font-light">{session.address}</td>
                  <td className="px-6 py-4 text-[12px] text-textSecondary font-light">{session.router_name}</td>
                  <td className="px-6 py-4 text-[12px] text-textSecondary font-light">{session.uptime}</td>
                  <td className="px-6 py-4 text-right">
                     <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50/50 text-emerald-500 rounded-full text-[10px]">
                       <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></div>
                       Online
                     </span>
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
