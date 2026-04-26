import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Server, Activity, Shield, Wifi, Share2, Terminal, Cpu,
  BarChart2, FileText, ArrowLeft, RefreshCw, Loader2,
  CheckCircle2, XCircle, XOctagon, Zap, HardDrive, Thermometer, Play, Pause, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import { apiFetch } from '../../../lib/apiClient';
import ConfirmModal from '../../../components/ui/ConfirmModal';

const API = '/api/router';

const LiveTrafficPoller = ({ routerId }: { routerId: string }) => {
  const [traffic, setTraffic] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let interval: any;
    const fetchTraffic = async () => {
      try {
        const res = await apiFetch(`${API}/${routerId}/monitor`);
        const data = await res.json();
        if (data.success && data.traffic) {
          setTraffic(data.traffic);
        }
      } catch (e) {
        // Silently swallow polling errors so we don't flash UI
      } finally {
        setLoading(false);
      }
    };
    
    if (!isPaused) {
      fetchTraffic();
      interval = setInterval(fetchTraffic, 3000); // 3-second live refresh
    }
    return () => clearInterval(interval);
  }, [routerId, isPaused]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[350px]">
      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-3" />
      <p className="text-[13px] text-textSecondary">Initializing Live Torch Monitoring...</p>
    </div>
  );

  return (
    <div className="animate-in fade-in transition-all">
      <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div>
          <h3 className="text-[14px] font-semibold text-textPrimary flex items-center gap-2">
            <span className={clsx("w-2 h-2 rounded-full", isPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse")}></span>
            Real-Time Interface Traffic
          </h3>
          <p className="text-[12px] text-textSecondary mt-1">Polling active gateways directly at 3-second intervals.</p>
        </div>
        <button 
          onClick={() => setIsPaused(!isPaused)} 
          className="btn-secondary flex items-center text-[12px]"
        >
          {isPaused ? <><Play className="w-4 h-4 mr-1.5" /> Resume Stream</> : <><Pause className="w-4 h-4 mr-1.5" /> Pause Stream</>}
        </button>
      </div>
      
      {!traffic.length ? (
        <div className="p-10 flex flex-col items-center justify-center text-center">
          <Activity className="w-8 h-8 text-textSecondary mb-3" />
          <p className="text-[13px] text-textSecondary">No active traffic streams detected.</p>
        </div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 shadow-sm">
              <Th>Interface</Th>
              <Th right>TX Rate (Upload)</Th>
              <Th right>RX Rate (Download)</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {traffic.map((t, idx) => {
              const tx = parseInt(t['tx-bits-per-second'] || '0');
              const rx = parseInt(t['rx-bits-per-second'] || '0');
              return (
                <tr key={t['.id'] || t.name || idx} className="hover:bg-white/5 group transition duration-300">
                  <Td>
                    <span className="font-mono text-[13px] font-semibold text-textPrimary bg-bgSecondary border border-white/10 px-2 py-1 rounded shadow-sm">
                      {t.name}
                    </span>
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-[14px] font-mono font-medium text-amber-600">{formatBytes(tx, true)}/s</span>
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${Math.min((tx / 10000000) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </Td>
                  <Td right>
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-[14px] font-mono font-medium text-blue-600">{formatBytes(rx, true)}/s</span>
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((rx / 10000000) * 100, 100)}%` }}></div>
                      </div>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

const Badge = ({ online }: { online: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${online ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white/10 text-textSecondary border border-white/10'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
    {online ? 'Online' : 'Offline'}
  </span>
);

const TabPanel = ({ loading, children }: { loading: boolean; children: React.ReactNode }) => {
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-3" />
      <p className="text-[13px] text-textSecondary">Polling RouterOS API...</p>
    </div>
  );
  return <>{children}</>;
};

const EmptyState = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="flex flex-col items-center justify-center h-48 text-center">
    <Icon className="w-8 h-8 text-textSecondary mb-3" />
    <p className="text-[13px] text-textSecondary">{label}</p>
  </div>
);

const Th = ({ children, right }: any) => (
  <th className={`px-5 py-3 text-[11px] font-medium text-textSecondary uppercase tracking-wider ${right ? 'text-right' : ''}`}>{children}</th>
);
const Td = ({ children, right, mono }: any) => (
  <td className={`px-5 py-3.5 text-[13px] text-textPrimary ${right ? 'text-right' : ''} ${mono ? 'font-mono' : 'font-medium'}`}>{children}</td>
);

export default function RouterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [router, setRouter] = useState<any>(null);
  const [tabData, setTabData] = useState<any>(null);
  const [routerLoading, setRouterLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');
  const [killLoading, setKillLoading] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchRouter = useCallback(async () => {
    setRouterLoading(true);
    try {
      const res = await apiFetch(`${API}/${id}`);
      const data = await res.json();
      if (data.success) setRouter(data.router);
    } catch (e) {
      console.error(e);
    } finally {
      setRouterLoading(false);
    }
  }, [id]);

  const confirmDelete = () => setShowConfirmModal(true);

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        navigate('/network/routers');
      } else {
        alert("Failed to delete router: " + data.error);
        setShowConfirmModal(false);
      }
    } catch (e) {
      console.error("Delete failed:", e);
      alert("An unexpected error occurred.");
      setShowConfirmModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchTabData = useCallback(async (tab: string) => {
    const endpointMap: Record<string, string> = {
      interfaces: 'interfaces', hotspot: 'hotspot', pppoe: 'pppoe',
      dhcp: 'dhcp', firewall: 'firewall', wireless: 'wireless', stats: 'stats', scripts: 'scripts',
    };
    const endpoint = endpointMap[tab];
    if (!endpoint) return;
    setTabLoading(true);
    setTabData(null);
    setTabError('');
    try {
      const res = await apiFetch(`${API}/${id}/${endpoint}`);
      const data = await res.json();
      if (data.success) setTabData(data);
      else setTabError(data.error || 'Failed to fetch data from router.');
    } catch (_) {
      setTabError('Cannot reach router. Ensure the backend can connect to this node.');
    } finally {
      setTabLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRouter(); }, [fetchRouter]);
  useEffect(() => {
    if (activeTab !== 'overview') fetchTabData(activeTab);
    else setTabData(null);
  }, [activeTab, fetchTabData]);

  const killSession = async (sessionId: string, type: 'pppoe' | 'hotspot') => {
    setKillLoading(sessionId);
    try {
      const endpoint = type === 'pppoe' ? 'pppoe-sessions' : 'hotspot-sessions';
      await apiFetch(`${API}/${id}/${endpoint}/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      fetchTabData(activeTab);
    } finally {
      setKillLoading(null);
    }
  };

  const forceSync = async () => {
    await apiFetch(`${API}/${id}/sync`, { method: 'POST' });
    fetchRouter();
  };

  const tabs = [
    { id: 'overview',    label: 'Overview',    icon: BarChart2 },
    { id: 'interfaces',  label: 'Interfaces',  icon: Activity  },
    { id: 'pppoe',       label: 'PPPoE',       icon: Share2    },
    { id: 'hotspot',     label: 'Hotspot',     icon: Wifi      },
    { id: 'dhcp',        label: 'DHCP Leases', icon: Cpu       },
    { id: 'firewall',    label: 'Firewall',    icon: Shield    },
    { id: 'wireless',    label: 'Wireless',    icon: Wifi      },
    { id: 'scripts',     label: 'Scripts',     icon: Terminal  },
    { id: 'monitor',     label: 'Live Monitor',icon: Activity  },
    { id: 'stats',       label: 'Health',      icon: Thermometer },
  ];

  if (routerLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
    </div>
  );

  if (!router) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-[13px] text-textSecondary">Router not found.</p>
    </div>
  );

  const isOnline = router.connection_status === 'online';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/network/routers')} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/10 transition shrink-0">
            <ArrowLeft className="w-4 h-4 text-textSecondary" />
          </button>
          <div className="relative shrink-0">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
              <Server className="w-6 h-6 text-textSecondary" />
            </div>
            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
          </div>
          <div>
            <h2 className="text-[18px] font-medium text-textPrimary">{router.name}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="font-mono text-[12px] text-textSecondary bg-white/10 px-2 py-0.5 rounded">{router.ip_address}:{router.api_port}</span>
              <Badge online={isOnline} />
              {router.router_os_version && <span className="text-[12px] text-textSecondary">RouterOS {router.router_os_version}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => navigate(`/network/routers/${id}/edit`)} className="btn-secondary flex items-center text-[13px]">
            Edit Settings
          </button>
          <button onClick={forceSync} className="btn-secondary flex items-center text-[13px]">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Sync
          </button>
          <button 
            onClick={confirmDelete}
            disabled={isDeleting}
            className="flex items-center px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 shadow-sm"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Decommission
          </button>
          <button className="btn-primary text-[13px]">Force Config Push</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-1 p-1 bg-white/10 rounded-xl border border-white/10/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center px-3.5 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-all gap-1.5',
              activeTab === tab.id ? 'bg-bgSecondary text-textPrimary shadow-sm ring-1 ring-slate-900/5' : 'text-textSecondary hover:text-textPrimary hover:bg-bgSecondary/60'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Error Banner */}
      {tabError && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800">
          <XOctagon className="w-4 h-4 text-amber-500 shrink-0" />
          {tabError} {!isOnline && '— This router is currently offline.'}
        </div>
      )}

      {/* Tab Content */}
      <div className="card p-0 overflow-hidden min-h-[350px]">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: 'Location', value: router.location || 'Not set' },
                { label: 'Connection Type', value: router.conn_type?.toUpperCase() || 'Direct' },
                { label: 'Total Users', value: router.total_users?.toLocaleString() || '0' },
                { label: 'Last Seen', value: router.last_seen_at ? new Date(router.last_seen_at).toLocaleString() : 'Never' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 border border-white/10 p-4 rounded-xl">
                  <p className="text-[11px] font-medium text-textSecondary uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-[14px] font-medium text-textPrimary">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-[12px] font-medium text-textSecondary mb-3">Click the <strong>Health</strong> tab above for live CPU, memory, and temperature data from this router.</p>
              <p className="text-[12px] text-textSecondary">Sync Status: <span className={`font-medium ${router.sync_status === 'synced' ? 'text-emerald-600' : 'text-amber-600'}`}>{router.sync_status || 'Unknown'}</span></p>
            </div>
          </div>
        )}

        {/* INTERFACES */}
        {activeTab === 'interfaces' && (
          <TabPanel loading={tabLoading}>
            {!tabData?.data?.length ? <EmptyState icon={Activity} label="No interfaces found or router offline." /> : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>Name</Th><Th>Type</Th><Th>Status</Th><Th right>RX</Th><Th right>TX</Th><Th>Comment</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.data.map((iface: any, idx: number) => (
                    <tr key={iface['.id'] || idx} className="hover:bg-white/5">
                      <Td><span className="font-mono text-[12px]">{iface.name}</span></Td>
                      <Td><span className="text-[11px] bg-white/10 text-textSecondary px-2 py-0.5 rounded">{iface.type || 'ether'}</span></Td>
                      <Td>
                        {iface.running === 'true' && iface.disabled !== 'true'
                          ? <span className="flex items-center gap-1 text-emerald-600 text-[12px]"><CheckCircle2 className="w-3.5 h-3.5" /> Running</span>
                          : <span className="flex items-center gap-1 text-textSecondary text-[12px]"><XCircle className="w-3.5 h-3.5" /> Inactive</span>}
                      </Td>
                      <Td right mono>{formatBytes(iface['rx-byte'])}</Td>
                      <Td right mono>{formatBytes(iface['tx-byte'])}</Td>
                      <Td><span className="text-textSecondary text-[12px]">{iface.comment || '—'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* PPPOE */}
        {activeTab === 'pppoe' && (
          <TabPanel loading={tabLoading}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-medium text-textPrimary">Active PPPoE Sessions</h3>
                <p className="text-[12px] text-textSecondary mt-0.5">{tabData?.active_sessions?.length || 0} currently connected</p>
              </div>
            </div>
            {!tabData?.active_sessions?.length ? (
              <EmptyState icon={Share2} label="No active PPPoE sessions on this router." />
            ) : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>Username</Th><Th>IP Address</Th><Th>MAC / Caller-ID</Th><Th>Uptime</Th><Th>Service</Th><Th right>Action</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.active_sessions.map((s: any, idx: number) => (
                    <tr key={s['.id'] || s.name || idx} className="hover:bg-white/5">
                      <Td><span className="font-mono text-[12px] bg-white/5 border border-white/10 px-2 py-0.5 rounded">{s.name}</span></Td>
                      <Td mono>{s.address || '—'}</Td>
                      <Td mono>{s['caller-id'] || '—'}</Td>
                      <Td><span className="text-emerald-600">{s.uptime || '—'}</span></Td>
                      <Td><span className="text-[11px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">{s.service || 'pppoe'}</span></Td>
                      <Td right>
                        <button
                          onClick={() => killSession(s['.id'], 'pppoe')}
                          disabled={killLoading === s['.id']}
                          className="text-[12px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1 rounded transition"
                        >
                          {killLoading === s['.id'] ? '...' : 'Kill'}
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* PPP Secrets */}
            <div className="p-5 border-t border-white/10 border-b border-white/10 mt-0">
              <h3 className="text-[14px] font-medium text-textPrimary mb-0.5">PPP Secrets (Accounts)</h3>
              <p className="text-[12px] text-textSecondary">{tabData?.accounts?.length || 0} provisioned</p>
            </div>
            {!tabData?.accounts?.length ? (
              <EmptyState icon={Share2} label="No PPP secrets found on this router." />
            ) : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>Username</Th><Th>Profile</Th><Th>Local Address</Th><Th>Remote Address</Th><Th right>Status</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.accounts.map((s: any, idx: number) => (
                    <tr key={s['.id'] || s.name || idx} className="hover:bg-white/5">
                      <Td mono>{s.name}</Td>
                      <Td>{s.profile || 'default'}</Td>
                      <Td mono>{s['local-address'] || '—'}</Td>
                      <Td mono>{s['remote-address'] || '—'}</Td>
                      <Td right>
                        {s.disabled === 'true'
                          ? <span className="text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded">Suspended</span>
                          : <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded">Active</span>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* HOTSPOT */}
        {activeTab === 'hotspot' && (
          <TabPanel loading={tabLoading}>
            <div className="p-5 border-b border-white/10">
              <h3 className="text-[14px] font-medium text-textPrimary">Active Hotspot Sessions</h3>
              <p className="text-[12px] text-textSecondary mt-0.5">{tabData?.active_sessions?.length || 0} currently connected</p>
            </div>
            {!tabData?.active_sessions?.length ? (
              <EmptyState icon={Wifi} label="No active hotspot sessions." />
            ) : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>User</Th><Th>IP</Th><Th>MAC</Th><Th>Uptime</Th><Th right>Action</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.active_sessions.map((s: any, idx: number) => (
                    <tr key={s['.id'] || s.user || idx} className="hover:bg-white/5">
                      <Td mono>{s.user || s.name || '—'}</Td>
                      <Td mono>{s.address || '—'}</Td>
                      <Td mono>{s['mac-address'] || '—'}</Td>
                      <Td><span className="text-emerald-600">{s.uptime || '—'}</span></Td>
                      <Td right>
                        <button
                          onClick={() => killSession(s['.id'], 'hotspot')}
                          disabled={killLoading === s['.id']}
                          className="text-[12px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1 rounded transition"
                        >
                          {killLoading === s['.id'] ? '...' : 'Kill'}
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* DHCP */}
        {activeTab === 'dhcp' && (
          <TabPanel loading={tabLoading}>
            {!tabData?.leases?.length ? <EmptyState icon={Cpu} label="No DHCP leases found." /> : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>IP Address</Th><Th>MAC Address</Th><Th>Hostname</Th><Th>Status</Th><Th>Expires</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.leases.map((l: any, idx: number) => (
                    <tr key={l['.id'] || l.address || idx} className="hover:bg-white/5">
                      <Td mono>{l.address || '—'}</Td>
                      <Td mono>{l['mac-address'] || '—'}</Td>
                      <Td>{l['host-name'] || '—'}</Td>
                      <Td><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${l.status === 'bound' ? 'bg-emerald-50 text-emerald-700' : 'bg-white/10 text-textSecondary'}`}>{l.status}</span></Td>
                      <Td>{l['expires-after'] || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* FIREWALL */}
        {activeTab === 'firewall' && (
          <TabPanel loading={tabLoading}>
            <div className="p-5 border-b border-white/10">
              <h3 className="text-[14px] font-medium text-textPrimary">Filter Rules <span className="text-textSecondary font-normal">({tabData?.rules?.filter?.length || 0})</span></h3>
            </div>
            {!tabData?.rules?.filter?.length ? <EmptyState icon={Shield} label="No filter rules found." /> : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>#</Th><Th>Chain</Th><Th>Protocol</Th><Th>Src/Dst</Th><Th>Action</Th><Th>Comment</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.rules.filter.slice(0, 50).map((r: any, i: number) => (
                    <tr key={r['.id'] || i} className="hover:bg-white/5">
                      <Td><span className="text-textSecondary text-[11px]">{i + 1}</span></Td>
                      <Td><span className="font-mono text-[11px] bg-white/10 px-1.5 py-0.5 rounded">{r.chain}</span></Td>
                      <Td><span className="text-[12px]">{r.protocol || 'any'}</span></Td>
                      <Td mono>{[r['src-address'], r['dst-address']].filter(Boolean).join(' → ') || '—'}</Td>
                      <Td><span className={`text-[11px] font-medium px-2 py-0.5 rounded ${r.action === 'drop' || r.action === 'reject' ? 'bg-rose-50 text-rose-700' : r.action === 'accept' ? 'bg-emerald-50 text-emerald-700' : 'bg-white/10 text-textSecondary'}`}>{r.action}</span></Td>
                      <Td><span className="text-textSecondary text-[12px]">{r.comment || '—'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* WIRELESS */}
        {activeTab === 'wireless' && (
          <TabPanel loading={tabLoading}>
            {!tabData?.clients?.length ? <EmptyState icon={Wifi} label="No wireless clients registered." /> : (
              <table className="w-full text-left">
                <thead><tr className="bg-white/5 border-b border-white/10"><Th>MAC Address</Th><Th>Signal</Th><Th>Interface</Th><Th>Uptime</Th><Th right>TX / RX Rate</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.clients.map((c: any, idx: number) => (
                    <tr key={c['.id'] || c['mac-address'] || idx} className="hover:bg-white/5">
                      <Td mono>{c['mac-address'] || '—'}</Td>
                      <Td><span className={`font-mono text-[12px] ${parseInt(c['signal-strength']) > -70 ? 'text-emerald-600' : 'text-amber-600'}`}>{c['signal-strength'] || '—'} dBm</span></Td>
                      <Td>{c.interface || '—'}</Td>
                      <Td>{c.uptime || '—'}</Td>
                      <Td right mono>{c['tx-rate'] || '—'} / {c['rx-rate'] || '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* HEALTH STATS */}
        {activeTab === 'stats' && (
          <TabPanel loading={tabLoading}>
            {!tabData?.hardware ? <EmptyState icon={Thermometer} label="Could not retrieve hardware stats. Router may be offline." /> : (
              <div className="p-6 space-y-6 animate-in fade-in">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'BoardName', value: tabData.hardware['board-name'] || '—' },
                    { label: 'RouterOS', value: tabData.hardware.version || '—' },
                    { label: 'Uptime', value: tabData.hardware.uptime || '—' },
                    { label: 'CPU Load', value: `${tabData.hardware['cpu-load'] || 0}%` },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 border border-white/10 p-4 rounded-xl">
                      <p className="text-[11px] text-textSecondary uppercase tracking-wider mb-1">{item.label}</p>
                      <p className="text-[15px] font-medium text-textPrimary">{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CPU */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between mb-3">
                      <span className="text-[13px] font-medium text-textPrimary">CPU Utilization</span>
                      <span className={`text-[13px] font-medium ${parseInt(tabData.hardware['cpu-load']) > 80 ? 'text-rose-600' : 'text-emerald-600'}`}>{tabData.hardware['cpu-load'] || 0}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className={`h-2 rounded-full ${parseInt(tabData.hardware['cpu-load']) > 80 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${tabData.hardware['cpu-load'] || 0}%` }} />
                    </div>
                  </div>
                  {/* Memory */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between mb-3">
                      <span className="text-[13px] font-medium text-textPrimary">Memory</span>
                      <span className="text-[13px] font-medium text-blue-600">
                        {formatBytes(tabData.hardware['free-memory'])} free of {formatBytes(tabData.hardware['total-memory'])}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.round((1 - (tabData.hardware['free-memory'] / tabData.hardware['total-memory'])) * 100)}%` }} />
                    </div>
                  </div>
                </div>
                {tabData.health && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <p className="text-[11px] text-amber-600 uppercase tracking-wider mb-1">Temperature</p>
                      <p className="text-[18px] font-medium text-textPrimary">{tabData.health.temperature || '—'}°C</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-[11px] text-blue-600 uppercase tracking-wider mb-1">Voltage</p>
                      <p className="text-[18px] font-medium text-textPrimary">{tabData.health.voltage || '—'}V</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabPanel>
        )}

        {/* SCRIPTS AND SCHEDULERS */}
        {activeTab === 'scripts' && (
          <TabPanel loading={tabLoading}>
            {/* Scripts */}
            <div className="p-5 border-b border-white/10 bg-white/5">
              <h3 className="text-[14px] font-semibold text-textPrimary">Router Scripts</h3>
              <p className="text-[12px] text-textSecondary mt-0.5">{tabData?.scripts?.length || 0} active scripts deployed on hardware</p>
            </div>
            {!tabData?.scripts?.length ? (
              <EmptyState icon={Terminal} label="No scripts found on this gateway." />
            ) : (
              <table className="w-full text-left">
                <thead><tr className="bg-bgSecondary border-b border-white/10 shadow-sm"><Th>Command Name</Th><Th>Run Count</Th><Th>Source Policy</Th><Th>Action</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.scripts.map((s: any, idx: number) => (
                    <tr key={s['.id'] || s.name || idx} className="hover:bg-white/5">
                      <Td><span className="font-mono text-[13px] font-bold text-textPrimary bg-white/10 border border-white/10 px-2 py-0.5 rounded shadow-sm">{s.name}</span></Td>
                      <Td><span className="text-[12px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{s['run-count'] || '0'} Executions</span></Td>
                      <Td><span className="text-[11px] text-textSecondary font-mono hidden md:inline-block truncate max-w-[200px]">{s.policy || 'default'}</span></Td>
                      <Td><button disabled className="text-[11px] font-bold tracking-widest text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition shadow-sm border border-emerald-100 uppercase">Run</button></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Schedulers */}
            <div className="p-5 border-y border-white/10 bg-white/5">
              <h3 className="text-[14px] font-semibold text-textPrimary">Job Schedulers</h3>
              <p className="text-[12px] text-textSecondary mt-0.5">{tabData?.schedulers?.length || 0} automated CRON tasks</p>
            </div>
            {!tabData?.schedulers?.length ? (
              <EmptyState icon={Terminal} label="No job schedulers found." />
            ) : (
              <table className="w-full text-left">
                <thead><tr className="bg-bgSecondary border-b border-white/10 shadow-sm"><Th>Job Identifier</Th><Th>Start Time</Th><Th>Interval</Th><Th right>Next Run</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {tabData.schedulers.map((s: any, idx: number) => (
                    <tr key={s['.id'] || s.name || idx} className="hover:bg-white/5">
                      <Td><span className="font-mono text-[13px] font-bold text-textPrimary">{s.name}</span></Td>
                      <Td><span className="text-[12px] text-textSecondary">{s['start-time'] || 'startup'}</span></Td>
                      <Td><span className="text-[12px] font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">{s.interval || '—'}</span></Td>
                      <Td right><span className="text-[12px] font-mono text-textSecondary">{s['next-run'] || '—'}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {/* LIVE MONITOR */}
        {activeTab === 'monitor' && <LiveTrafficPoller routerId={router.id} />}

      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Decommission Router"
        message={
          <>
            Are you sure you want to decommission <strong>{router.name}</strong>?<br/>
            This will detach all customers linked to this node.
          </>
        }
        confirmText="Decommission"
        onConfirm={performDelete}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}

function formatBytes(bytes: any, isBits: boolean = false): string {
  const n = parseInt(bytes);
  if (isNaN(n)) return '—';
  const unit = isBits ? 'bps' : 'B';
  const unitK = isBits ? 'Kbps' : 'KB';
  const unitM = isBits ? 'Mbps' : 'MB';
  const unitG = isBits ? 'Gbps' : 'GB';
  
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} ${unitG}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} ${unitM}`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} ${unitK}`;
  return `${n} ${unit}`;
}
