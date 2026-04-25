import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Globe, Zap, ArrowUpRight, 
  ArrowDownLeft, Trash2, Search, RefreshCw,
  ShieldCheck, Wifi, Radio
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

interface Session {
  source: 'mikrotik' | 'radius';
  username: string;
  ip: string;
  mac: string;
  uptime: string;
  download: string;
  upload: string;
  router_name: string;
  router_id?: string;
  session_id?: string;
  service?: string;
}

export default function LiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchSessions = async () => {
    try {
      const resp = await apiFetch('/api/sessions/live');
      const data = await resp.json();
      if (data.success) {
        setSessions(data.sessions);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch live sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async (session: Session) => {
    if (!session.router_id || !session.session_id) {
        alert('Remote disconnect is only available for direct MikroTik sessions currently.');
        return;
    }

    if (!window.confirm(`Are you sure you want to terminate session for ${session.username}?`)) return;

    setDisconnecting(session.session_id);
    try {
      const resp = await apiFetch('/api/sessions/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          router_id: session.router_id,
          session_id: session.session_id,
          service: session.service,
          username: session.username
        })
      });
      const data = await resp.json();
      if (data.success) {
        fetchSessions();
      } else {
        alert(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      alert('Network error during disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const filtered = sessions.filter(s => 
    s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.ip.includes(searchTerm) ||
    s.mac.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: sessions.length,
    mikrotik: sessions.filter(s => s.source === 'mikrotik').length,
    radius: sessions.filter(s => s.source === 'radius').length
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* Header & Stats Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-light text-slate-800 tracking-tight">Live Subscriber Hub</h2>
          <p className="text-[12px] text-slate-400 mt-1 flex items-center">
            <Activity className="w-3 h-3 text-emerald-500 mr-2" />
            Monitoring real-time sessions across your hybrid network
          </p>
        </div>

        <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
           <div className="text-center">
             <p className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">Active Users</p>
             <p className="text-xl font-light text-slate-800">{stats.total}</p>
           </div>
           <div className="w-px h-8 bg-slate-100"></div>
           <div className="text-center">
             <p className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">MikroTik API</p>
             <p className="text-xl font-light text-emerald-600">{stats.mikrotik}</p>
           </div>
           <div className="w-px h-8 bg-slate-100"></div>
           <div className="text-center">
             <p className="text-[10px] text-slate-400 font-normal uppercase tracking-wider">RADIUS AAA</p>
             <p className="text-xl font-light text-blue-600">{stats.radius}</p>
           </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input 
            type="text"
            placeholder="Search by username, IP, or MAC..."
            className="w-full bg-white border border-slate-100 rounded-xl pl-11 pr-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <p className="text-[11px] text-slate-400 mr-2">Last updated: {lastRefreshed.toLocaleTimeString()}</p>
          <button 
            onClick={fetchSessions}
            disabled={loading}
            className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-emerald-600 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sessions Grid/Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading && sessions.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center">
             <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
             <p className="text-[13px] text-slate-400">Polling network nodes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center p-8">
             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-slate-200" />
             </div>
             <p className="text-[15px] font-normal text-slate-600">No active sessions found</p>
             <p className="text-[12px] text-slate-400 mt-1">Check if your routers are online or adjust your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider">Subscriber</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider">Source / Service</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider">IP / MAC Address</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider">Uptime</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider text-right">Consumption</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s, i) => (
                  <tr key={`${s.username}-${i}`} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 text-[12px] font-medium border border-emerald-100/50">
                          {s.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-normal text-slate-700">{s.username}</p>
                          <p className="text-[10px] text-slate-400">{s.router_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {s.source === 'mikrotik' ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md text-[10px] font-medium">
                            <Zap className="w-3 h-3" /> API
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[10px] font-medium">
                            <ShieldCheck className="w-3 h-3" /> RADIUS
                          </div>
                        )}
                        <span className="text-[11px] text-slate-500 uppercase font-mono">{s.service || 'PPPoE'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="text-[12px] text-slate-600 font-mono">{s.ip}</p>
                       <p className="text-[10px] text-slate-400 font-mono">{s.mac}</p>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-[12px] text-slate-500">{s.uptime}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="inline-block text-right">
                          <div className="flex items-center justify-end gap-2 text-[12px] text-slate-700">
                             <ArrowDownLeft className="w-3 h-3 text-emerald-500" /> {s.download}
                          </div>
                          <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400">
                             <ArrowUpRight className="w-3 h-3 text-blue-400" /> {s.upload}
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       {s.source === 'mikrotik' ? (
                         <button 
                           onClick={() => handleDisconnect(s)}
                           disabled={disconnecting === s.session_id}
                           className="p-2 text-slate-300 hover:text-rose-500 transition-all rounded-lg hover:bg-rose-50"
                           title="Disconnect User"
                         >
                           {disconnecting === s.session_id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                         </button>
                       ) : (
                         <span className="text-[10px] text-slate-300 italic">No direct kill</span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
         <Globe className="w-4 h-4 text-blue-500 mt-0.5" />
         <p className="text-[12px] text-blue-700 leading-relaxed">
           <strong>Smart Monitoring:</strong> We poll MikroTik API for precise real-time counters. RADIUS data is based on the last accounting interim update (usually every 5-10 mins). Live "Kill" commands are sent directly to the hardware gateway.
         </p>
      </div>
    </div>
  );
}
