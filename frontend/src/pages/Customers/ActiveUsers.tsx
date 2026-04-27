import React, { useState, useEffect, useCallback } from 'react';
import { IconCircleX, IconLoader2, IconRefresh, IconShare, IconUsers, IconWifi } from '@tabler/icons-react';;
import CustomLoader from '../../components/common/CustomLoader';

import { apiFetch } from '../../lib/apiClient';

const API = '/api/router';

export default function ActiveUsers() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [killLoading, setKillLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`${API}/sessions/all`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
        setLastRefresh(new Date());
      } else {
        setError(data.error || 'Failed to fetch sessions.');
      }
    } catch (_) {
      setError('Cannot reach backend. Ensure the server is running on port 3000.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 60_000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const killSession = async (session: any) => {
    setKillLoading(session['.id']);
    try {
      const endpoint = session.type === 'hotspot' ? 'hotspot-sessions' : 'pppoe-sessions';
      await apiFetch(`${API}/${session.router_id}/${endpoint}/${encodeURIComponent(session['.id'])}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s['.id'] !== session['.id']));
    } catch (e) {
      alert('Failed to kill session. Router may be unreachable.');
    } finally {
      setKillLoading(null);
    }
  };

  const filtered = sessions.filter(s => {
    const q = search.toLowerCase();
    const name = s.username || s.name || s.user || '';
    return !q || name.toLowerCase().includes(q)
      || (s.address || s.ip || '').includes(q)
      || (s.router_name || '').toLowerCase().includes(q);
  });

  const pppoe   = filtered.filter(s => (s.service || s.type || '').toLowerCase() === 'pppoe');
  const hotspot = filtered.filter(s => (s.service || s.type || '').toLowerCase() === 'hotspot');
  // Catch any sessions without a specific type (RADIUS sessions sometimes just say 'PPPoE' with capital)
  const others  = filtered.filter(s => {
    const svc = (s.service || s.type || '').toLowerCase();
    return svc !== 'pppoe' && svc !== 'hotspot';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-textPrimary">Active Sessions</h2>
          <p className="text-[13px] text-textSecondary mt-1">
            {loading ? 'Polling RouterOS...' : `${sessions.length} connected — ${pppoe.length} PPPoE · ${hotspot.length} Hotspot · ${others.length} Other`}
            {lastRefresh && !loading && <span className="ml-2 text-textSecondary">· Refreshed {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={fetchSessions} disabled={loading} className="btn-secondary flex items-center text-[13px]">
          <IconRefresh className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <IconWifi className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by username, IP, or router..." className="pl-10 input-field" />
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800">
          <IconCircleX className="w-4 h-4 text-amber-500 shrink-0" />
          {error}
        </div>
      )}

      {loading && !sessions.length ? (
        <div className="card flex flex-col items-center justify-center h-52">
          <CustomLoader />
          <p className="text-[13px] text-textSecondary">Connecting to all active routers...</p>
        </div>
      ) : !sessions.length && !error ? (
        <div className="card flex flex-col items-center justify-center h-52 text-center">
          <IconUsers className="w-8 h-8 text-textSecondary mb-3" />
          <h3 className="text-[14px] font-medium text-textPrimary mb-1">No Active Sessions</h3>
          <p className="text-[13px] text-textSecondary">No subscribers are currently connected across any linked router.</p>
        </div>
      ) : (
        <>
          {/* PPPoE Table */}
          {pppoe.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <IconShare className="w-4 h-4 text-blue-500" />
                <h3 className="text-[14px] font-medium text-textPrimary">PPPoE Sessions <span className="text-textSecondary font-normal">({pppoe.length})</span></h3>
              </div>
              <div className="card p-0 overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                      <th className="px-5 py-3.5">Username</th>
                      <th className="px-5 py-3.5">IP Address</th>
                      <th className="px-5 py-3.5">MAC / Caller-ID</th>
                      <th className="px-5 py-3.5">Uptime</th>
                      <th className="px-5 py-3.5">Router</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pppoe.map(s => {
                      const sessionId = s.id || s['.id'] || s.session_id;
                      const username = s.username || s.name || '—';
                      const ip = s.address || s.ip || '—';
                      const mac = s['caller-id'] || s.mac || '—';
                      return (
                        <tr key={`${s.router_id}-${sessionId}`} className="hover:bg-white/5 transition">
                          <td className="px-5 py-3.5"><span className="font-mono text-[12px] bg-white/5 border border-white/10 px-2 py-0.5 rounded">{username}</span></td>
                          <td className="px-5 py-3.5 font-mono text-[12px] text-textPrimary">{ip}</td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-textSecondary">{mac}</td>
                          <td className="px-5 py-3.5 text-[13px] text-emerald-600 font-medium">{s.uptime || '—'}</td>
                          <td className="px-5 py-3.5 text-[12px] text-textSecondary">{s.router_name}</td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => killSession({...s, '.id': sessionId})}
                              disabled={killLoading === sessionId}
                              className="text-[12px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1 rounded transition"
                            >
                              {killLoading === sessionId ? '...' : 'Disconnect'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hotspot Table */}
          {hotspot.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <IconWifi className="w-4 h-4 text-emerald-500" />
                <h3 className="text-[14px] font-medium text-textPrimary">Hotspot Sessions <span className="text-textSecondary font-normal">({hotspot.length})</span></h3>
              </div>
              <div className="card p-0 overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                      <th className="px-5 py-3.5">User</th>
                      <th className="px-5 py-3.5">IP</th>
                      <th className="px-5 py-3.5">MAC Address</th>
                      <th className="px-5 py-3.5">Uptime</th>
                      <th className="px-5 py-3.5">Router</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {hotspot.map(s => (
                      <tr key={`${s.router_id}-${s['.id']}`} className="hover:bg-white/5 transition">
                        <td className="px-5 py-3.5 font-mono text-[12px] text-textPrimary">{s.user || s.name || '—'}</td>
                        <td className="px-5 py-3.5 font-mono text-[12px] text-textPrimary">{s.address || '—'}</td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-textSecondary">{s['mac-address'] || '—'}</td>
                        <td className="px-5 py-3.5 text-[13px] text-emerald-600 font-medium">{s.uptime || '—'}</td>
                        <td className="px-5 py-3.5 text-[12px] text-textSecondary">{s.router_name}</td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => killSession(s)}
                            disabled={killLoading === s['.id']}
                            className="text-[12px] font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1 rounded transition"
                          >
                            {killLoading === s['.id'] ? '...' : 'Disconnect'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
