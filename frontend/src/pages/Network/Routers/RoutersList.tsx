import React, { useState, useEffect } from 'react';
import { IconCircleCheck, IconCircleX, IconCpu, IconDotsVertical, IconFilter, IconPlus, IconRefresh, IconRouter, IconSearch, IconServer, IconTrash } from '@tabler/icons-react';;
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';
import ConfirmModal from '../../../components/ui/ConfirmModal';

export default function RoutersList() {
  const navigate = useNavigate();
  const [routers, setRouters] = useState<any[]>([]);
  const [liveStatus, setLiveStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: '', name: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRouters();
  }, []);

  const fetchRouters = async () => {
    setLoading(true);
    try {
      // Step 1: Fetch the core router list first so we show SOMETHING immediately
      const res = await apiFetch('/api/router');
      const data = await res.json();
      if (data.success) {
        setRouters(data.routers);
      }

      // Step 2: Fetch the live overview in the background
      // This way, if it fails or hangs, the router list is already visible
      apiFetch('/api/router/overview')
        .then(res => res.json())
        .then(overviewData => {
          if (overviewData.success && overviewData.overview?.router_metrics) {
            const statusMap: Record<string, any> = {};
            overviewData.overview.router_metrics.forEach((m: any) => {
              statusMap[m.id] = m;
            });
            setLiveStatus(statusMap);
          }
        })
        .catch(err => console.warn("Live status sync delayed:", err));

    } catch (error) {
      console.error("Failed to load routers:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (id: string, name: string) => {
    setConfirmModal({ isOpen: true, id, name });
  };

  const performDelete = async () => {
    const { id } = confirmModal;
    if (!id) return;
    
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/router/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRouters();
      } else {
        alert("Failed to delete router: " + data.error);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("An unexpected error occurred.");
    } finally {
      setDeletingId(null);
      setConfirmModal({ isOpen: false, id: '', name: '' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-textPrimary">Network Routers</h2>
          <p className="text-sm text-textSecondary mt-1">Manage network gateways ({routers.length} total nodes)</p>
        </div>
        <button 
          onClick={() => navigate('/network/routers/add')}
          className="btn-primary flex items-center shadow-md hover:shadow-lg"
        >
          <IconPlus className="w-5 h-5 mr-2" />
          Link New Router
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
        <div className="relative flex-1 max-w-md">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name, IP, or location..." 
            className="pl-10 input-field"
          />
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">
            <IconFilter className="w-4 h-4 mr-2 text-textSecondary" /> Filters
          </button>
          <button className="btn-secondary">
            <IconRefresh className="w-4 h-4 mr-2 text-textSecondary" /> Sync List
          </button>
        </div>
      </div>

      {/* Routers Table */}
      <div className="card p-0 overflow-x-auto">
        {routers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <IconServer className="w-8 h-8 text-textSecondary mb-4" />
            <h3 className="text-[15px] font-medium text-textPrimary mb-1">No Routers Found</h3>
            <p className="text-[13px] text-textSecondary max-w-sm mb-6">
              You haven't linked any NAS gateways yet. Add a router to begin processing connected user sessions.
            </p>
            <button onClick={() => navigate('/network/routers/add')} className="btn-primary">
              <IconPlus className="w-4 h-4 mr-2" /> Link Router
            </button>
          </div>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                <th className="px-6 py-3.5">Router Name</th>
                <th className="px-6 py-3.5">Vendor</th>
                <th className="px-6 py-3.5">Connection</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Active Sessions</th>
                <th className="px-6 py-3.5">Firmware</th>
                <th className="px-6 py-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {routers.map((router) => (
                <tr key={router.id} className="hover:bg-white/5 transition duration-150 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div>
                        <p className="font-medium text-[14px] text-textPrimary cursor-pointer group-hover:text-emerald-600 transition-colors" onClick={() => navigate(`/network/routers/${router.id}`)}>
                          {router.name}
                        </p>
                        <p className="text-[12px] text-textSecondary mt-0.5">{router.location || 'No Location'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {router.vendor === 'radius' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full">
                        <IconRouter className="w-3 h-3" /> RADIUS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        <IconCpu className="w-3 h-3" /> MikroTik
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-[13px] text-textPrimary bg-white/5 border border-white/10 px-2.5 py-1 rounded-md w-fit mb-1">{router.ip_address}</p>
                    <p className="text-[11px] text-textSecondary">Port {router.api_port}</p>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const live = liveStatus[router.id];
                      const status = live?.status || router.connection_status;
                      if (status === 'online') return (
                        <span className="badge-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" /> Online
                        </span>
                      );
                      if (status === 'warning' || status === 'error') return (
                        <span className="badge-warning bg-amber-50 text-amber-700 border-amber-200" title={live?.uptime || 'API Issue'}>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" /> 
                          {status === 'error' ? 'API Error' : 'RADIUS Only'}
                        </span>
                      );
                      if (status === 'pending') return (
                        <span className="inline-flex items-center text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-full" title={live?.uptime || 'Awaiting connection'}>
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5" /> Awaiting Auth
                        </span>
                      );
                      return (
                        <span className="badge-error bg-white/5 text-textSecondary border-white/10" title={live?.uptime || 'Disconnected'}>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" /> Offline
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[14px] font-medium text-textPrimary">
                      {liveStatus[router.id]?.active_sessions ?? router.total_users ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {router.vendor === 'radius' ? (
                      <span className="text-[12px] font-medium text-blue-400 bg-blue-500/15 border border-blue-500/20 px-2 py-0.5 rounded">RADIUS AAA</span>
                    ) : (
                      <span className="text-[12px] font-medium text-textSecondary">{liveStatus[router.id]?.os_version || router.router_os_version || 'Polling...'}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                    <button 
                      onClick={() => navigate(`/network/routers/${router.id}`)} 
                      className="text-[13px] font-medium text-textSecondary hover:text-emerald-600 transition-colors"
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => requestDelete(router.id, router.name)}
                      disabled={deletingId === router.id}
                      className="p-1.5 rounded-lg text-textSecondary hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Decommission Router"
                    >
                      {deletingId === router.id ? (
                        <IconRefresh className="w-4 h-4 animate-spin text-textSecondary" />
                      ) : (
                        <IconTrash className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Decommission Router"
        message={
          <>
            Are you sure you want to decommission <strong>{confirmModal.name}</strong>?<br/>
            This will detach all customers linked to this node.
          </>
        }
        confirmText="Decommission"
        onConfirm={performDelete}
        onCancel={() => setConfirmModal({ isOpen: false, id: '', name: '' })}
      />
    </div>
  );
}
