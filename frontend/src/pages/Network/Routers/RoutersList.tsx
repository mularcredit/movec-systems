import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, RefreshCw, Server, CheckCircle2, XCircle, Cpu, Radio, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';
import ConfirmModal from '../../../components/ui/ConfirmModal';

export default function RoutersList() {
  const navigate = useNavigate();
  const [routers, setRouters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: '', name: '' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRouters();
  }, []);

  const fetchRouters = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/router');
      const data = await res.json();
      if (data.success) {
        setRouters(data.routers);
      }
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
          <h2 className="text-2xl font-medium text-slate-800">Network Routers</h2>
          <p className="text-sm text-slate-500 mt-1">Manage network gateways ({routers.length} total nodes)</p>
        </div>
        <button 
          onClick={() => navigate('/network/routers/add')}
          className="btn-primary flex items-center shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          Link New Router
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name, IP, or location..." 
            className="pl-10 input-field"
          />
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary">
            <Filter className="w-4 h-4 mr-2 text-slate-400" /> Filters
          </button>
          <button className="btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2 text-slate-400" /> Sync List
          </button>
        </div>
      </div>

      {/* Routers Table */}
      <div className="card p-0 overflow-x-auto">
        {routers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Server className="w-8 h-8 text-slate-300 mb-4" />
            <h3 className="text-[15px] font-medium text-slate-800 mb-1">No Routers Found</h3>
            <p className="text-[13px] text-slate-500 max-w-sm mb-6">
              You haven't linked any NAS gateways yet. Add a router to begin processing connected user sessions.
            </p>
            <button onClick={() => navigate('/network/routers/add')} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" /> Link Router
            </button>
          </div>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#fbfbfd] text-slate-500 text-[11px] font-medium uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-6 py-3.5">Router Name</th>
                <th className="px-6 py-3.5">Vendor</th>
                <th className="px-6 py-3.5">Connection</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Active Sessions</th>
                <th className="px-6 py-3.5">Firmware</th>
                <th className="px-6 py-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routers.map((router) => (
                <tr key={router.id} className="hover:bg-slate-50/50 transition duration-150 group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div>
                        <p className="font-medium text-[14px] text-slate-800 cursor-pointer group-hover:text-emerald-600 transition-colors" onClick={() => navigate(`/network/routers/${router.id}`)}>
                          {router.name}
                        </p>
                        <p className="text-[12px] text-slate-500 mt-0.5">{router.location || 'No Location'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {router.vendor === 'radius' ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                        <Radio className="w-3 h-3" /> RADIUS
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <Cpu className="w-3 h-3" /> MikroTik
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-mono text-[13px] text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md w-fit mb-1">{router.ip_address}</p>
                    <p className="text-[11px] text-slate-400">Port {router.api_port}</p>
                  </td>
                  <td className="px-6 py-4">
                    {router.connection_status === 'online' ? (
                      <span className="badge-success">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" /> Online
                      </span>
                    ) : router.connection_status === 'warning' ? (
                      <span className="badge-warning">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" /> Warning
                      </span>
                    ) : (
                      <span className="badge-error bg-slate-50 text-slate-600 border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5" /> Offline
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-[14px] font-medium text-slate-700">{router.total_users?.toLocaleString() || 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-medium text-slate-600">{router.router_os_version || 'Unknown'}</span>
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                    <button 
                      onClick={() => navigate(`/network/routers/${router.id}`)} 
                      className="text-[13px] font-medium text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => requestDelete(router.id, router.name)}
                      disabled={deletingId === router.id}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                      title="Decommission Router"
                    >
                      {deletingId === router.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
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
