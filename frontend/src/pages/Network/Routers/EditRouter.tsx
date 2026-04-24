import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Loader2, Save, Cpu, Radio, ShieldAlert, Key, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../../lib/apiClient';

export default function EditRouter() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [vendor, setVendor] = useState<'mikrotik' | 'radius'>('mikrotik');
  const [routerName, setRouterName] = useState('');
  const [connType, setConnType] = useState('wireguard');
  
  // MikroTik
  const [directIp, setDirectIp] = useState('');
  const [apiPort, setApiPort] = useState('8729');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState(''); // leave blank to distinct
  // RADIUS
  const [nasIp, setNasIp] = useState('');
  const [radiusSecret, setRadiusSecret] = useState('');
  
  useEffect(() => {
    fetchRouterDetails();
  }, [id]);

  const fetchRouterDetails = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/router/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const r = data.router;
      setVendor(r.vendor);
      setRouterName(r.name);
      setConnType(r.conn_type || 'direct');
      
      if (r.vendor === 'mikrotik') {
        setDirectIp(r.ip_address || '');
        setApiPort(r.api_port || '');
      } else {
        setNasIp(r.vendor_config?.nas_ip || '');
        setRadiusSecret(r.vendor_config?.radius_secret || '');
      }
    } catch (e: any) {
      setError('Failed to load router: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const body: any = {
        name: routerName,
        vendor,
        conn_type: vendor === 'radius' ? 'direct' : connType,
      };

      if (vendor === 'mikrotik') {
        body.ip_address = directIp;
        body.api_port = apiPort;
        if (authUser && authPass) {
          body.username = authUser;
          body.password = authPass;
        }
      } else {
        body.ip_address = nasIp;
        body.api_port = 1812;
        body.vendor_config = {
          nas_ip: nasIp,
          radius_secret: radiusSecret
        };
      }

      const res = await apiFetch(`/api/router/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update router');
      navigate(`/network/routers/${id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/network/routers/${id}`)} className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center hover:bg-slate-50 transition border border-slate-200">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h2 className="text-2xl font-medium text-slate-800">Edit Router</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Update configuration for {routerName}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
                {vendor === 'mikrotik' 
                 ? <span className="inline-flex items-center text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><Cpu className="w-3.5 h-3.5 mr-1.5" /> MikroTik</span>
                 : <span className="inline-flex items-center text-[12px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full"><Radio className="w-3.5 h-3.5 mr-1.5" /> RADIUS NAS</span>
                }
            </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Router Name</label>
              <input type="text" required value={routerName} onChange={e => setRouterName(e.target.value)} className="auth-input max-w-sm" />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {vendor === 'mikrotik' && (
            <div className="space-y-6">
              <h3 className="text-[14px] font-semibold text-slate-800">Connection Details</h3>
              <div className="grid grid-cols-2 gap-5">
                 <div>
                    <label className="block text-[13px] font-medium text-slate-700 mb-1.5">Connection Type</label>
                    <select value={connType} onChange={e => setConnType(e.target.value)} className="auth-input">
                        <option value="direct">Direct Public IP</option>
                        <option value="wireguard">WireGuard Tunnel</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[13px] font-medium text-slate-700 mb-1.5">IP Address</label>
                    <input type="text" required value={directIp} onChange={e => setDirectIp(e.target.value)} className="auth-input font-mono" />
                 </div>
                 <div>
                    <label className="block text-[13px] font-medium text-slate-700 mb-1.5">API Port</label>
                    <input type="number" required value={apiPort} onChange={e => setApiPort(e.target.value)} className="auth-input font-mono" />
                 </div>
              </div>
              
              <div className="mt-8">
                  <h3 className="text-[14px] font-semibold text-slate-800 mb-4 flex items-center gap-2"><Key className="w-4 h-4 text-slate-400"/> Update API Credentials</h3>
                  <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 mb-4">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-800">Leave these fields blank to keep the existing credentials unchanged. If you are updating credentials, you must provide both the username and password.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                      <div>
                          <label className="block text-[13px] font-medium text-slate-700 mb-1.5">New API Username</label>
                          <input type="text" value={authUser} onChange={e => setAuthUser(e.target.value)} className="auth-input font-mono" placeholder="Leave blank to keep existing" />
                      </div>
                      <div>
                          <label className="block text-[13px] font-medium text-slate-700 mb-1.5">New API Password</label>
                          <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} className="auth-input font-mono" placeholder="••••••••" />
                      </div>
                  </div>
              </div>
            </div>
          )}

          {vendor === 'radius' && (
            <div className="space-y-6">
              <h3 className="text-[14px] font-semibold text-slate-800">RADIUS Configuration</h3>
              <div className="grid grid-cols-2 gap-5">
                 <div className="col-span-2">
                    <label className="block text-[13px] font-medium text-slate-700 mb-0.5">NAS IP Address</label>
                    <p className="text-[11px] text-slate-400 mb-1.5 pb-1">The Public / WAN IP Address this router will use to communicate with the system.</p>
                    <input type="text" value={nasIp} onChange={e => setNasIp(e.target.value)} className="auth-input font-mono max-w-sm" placeholder="Leave blank to accept from any IP" />
                 </div>
                 <div className="col-span-2">
                    <label className="block text-[13px] font-medium text-slate-700 mb-0.5">RADIUS Shared Secret</label>
                    <p className="text-[11px] text-slate-400 mb-1.5 pb-1">Ensure this matches the secret configured on the NAS device.</p>
                    <input type="text" required value={radiusSecret} onChange={e => setRadiusSecret(e.target.value)} className="auth-input font-mono max-w-sm" />
                 </div>
              </div>
            </div>
          )}

          {error && (
             <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100 flex items-start gap-3">
                 <ShieldAlert className="w-5 h-5 shrink-0" />
                 {error}
             </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
             <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
             <button type="submit" disabled={isSaving} className="btn-primary">
                 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                 Save Changes
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
