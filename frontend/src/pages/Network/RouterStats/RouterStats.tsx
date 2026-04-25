import React, { useState, useEffect } from 'react';
import { 
  Cpu, MemoryStick, Activity, Wifi, RefreshCw, 
  AlertTriangle, CheckCircle, XCircle, ArrowUpRight,
  ArrowDownLeft, Radio, Server, Clock
} from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';

interface RouterMetric {
  id: string;
  name: string;
  vendor: string;
  status: string;
  cpu_load?: number | string;
  free_memory?: number | string;
  uptime?: string;
  active_sessions?: number;
  tx_bps?: number;
  rx_bps?: number;
  os_version?: string;
}

interface Overview {
  total_routers: number;
  online_routers: number;
  offline_routers: number;
  total_active_sessions: number;
  total_tx_bps: number;
  total_rx_bps: number;
  router_metrics: RouterMetric[];
}

function formatBps(bps: number): string {
  if (!bps || bps === 0) return '0 Kbps';
  if (bps >= 1_000_000) return (bps / 1_000_000).toFixed(2) + ' Mbps';
  if (bps >= 1_000) return (bps / 1_000).toFixed(1) + ' Kbps';
  return bps + ' bps';
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'online') return (
    <span className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full font-normal">
      <CheckCircle className="w-3 h-3" /> Online
    </span>
  );
  if (status === 'warning') return (
    <span className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full font-normal">
      <AlertTriangle className="w-3 h-3" /> RADIUS Only
    </span>
  );
  if (status === 'pending') return (
    <span className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full font-normal">
      <Radio className="w-3 h-3" /> Pending
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-0.5 rounded-full font-normal">
      <XCircle className="w-3 h-3" /> Offline
    </span>
  );
}

export default function RouterStats() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch('/api/router/overview');
      const data = await resp.json();
      if (data.success) {
        setOverview(data.overview);
        setLastRefreshed(new Date());
      } else {
        setError(data.error || 'Failed to load network overview');
      }
    } catch (err: any) {
      setError('Could not reach backend. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-light text-slate-800 tracking-tight">Network Edge</h2>
          <p className="text-[12px] text-slate-400 mt-1">Real-time health metrics across all routers</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-slate-400">Last updated: {lastRefreshed.toLocaleTimeString()}</p>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-emerald-600 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Stats Strip */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Routers', value: overview.total_routers, icon: Server, color: 'text-slate-600' },
            { label: 'Online', value: overview.online_routers, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Active Sessions', value: overview.total_active_sessions, icon: Activity, color: 'text-blue-600' },
            { label: 'Total Upload', value: formatBps(overview.total_tx_bps), icon: ArrowUpRight, color: 'text-purple-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-normal">{stat.label}</p>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className={`text-2xl font-light ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-normal text-red-700">Failed to load router stats</p>
            <p className="text-[12px] text-red-500 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !overview && (
        <div className="bg-white border border-slate-100 rounded-2xl h-64 flex flex-col items-center justify-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
          <p className="text-[13px] text-slate-400">Polling router nodes...</p>
        </div>
      )}

      {/* Per-Router Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {overview.router_metrics.map((router) => (
            <div key={router.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              
              {/* Router Header */}
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
                <div>
                  <p className="text-[14px] font-normal text-slate-800">{router.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wider font-normal">{router.vendor}</p>
                </div>
                <StatusBadge status={router.status} />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-px bg-slate-50">
                
                <div className="bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-normal">CPU Load</p>
                  </div>
                  {router.status === 'online' ? (
                    <>
                      <p className="text-xl font-light text-slate-800">{router.cpu_load ?? '—'}%</p>
                      <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-400 rounded-full transition-all"
                          style={{ width: `${Math.min(Number(router.cpu_load) || 0, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xl font-light text-slate-300">—</p>
                  )}
                </div>

                <div className="bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-normal">Active Sessions</p>
                  </div>
                  <p className="text-xl font-light text-blue-600">{router.active_sessions ?? 0}</p>
                </div>

                <div className="bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-normal">Download</p>
                  </div>
                  <p className="text-xl font-light text-slate-800">{formatBps(router.rx_bps || 0)}</p>
                </div>

                <div className="bg-white p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-normal">Upload</p>
                  </div>
                  <p className="text-xl font-light text-slate-800">{formatBps(router.tx_bps || 0)}</p>
                </div>
              </div>

              {/* Uptime Footer */}
              <div className="px-6 py-3 border-t border-slate-50 flex items-center gap-2">
                <Clock className="w-3 h-3 text-slate-300" />
                <p className="text-[11px] text-slate-400 font-normal">
                  {router.uptime || (router.status === 'offline' ? 'Unreachable' : 'Polling...')}
                </p>
                {router.os_version && (
                  <span className="ml-auto text-[10px] text-slate-300 font-mono">{router.os_version}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && overview && overview.router_metrics.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl h-64 flex flex-col items-center justify-center shadow-sm">
          <Wifi className="w-10 h-10 text-slate-200 mb-4" />
          <p className="text-[14px] font-normal text-slate-500">No routers found</p>
          <p className="text-[12px] text-slate-400 mt-1">Use the Onboarding Wizard to add your first router</p>
        </div>
      )}
    </div>
  );
}
