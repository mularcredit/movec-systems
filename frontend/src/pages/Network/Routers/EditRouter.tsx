import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { IconActivity, IconAlertTriangle, IconArrowLeft, IconCpu, IconDeviceFloppy, IconKey, IconLoader2, IconRouter, IconShieldX } from '@tabler/icons-react';;
import CustomLoader from '../../../components/common/CustomLoader';

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
        // RADIUS router
        setNasIp(r.vendor_config?.nas_ip || r.ip_address || '');
        setRadiusSecret(r.vendor_config?.radius_secret || '');
        // Load existing API username hint (not password — it's encrypted)
        setAuthUser(r.username_encrypted ? '(credentials stored)' : '');
        // Also pre-fill the API port if it was set
        if (r.api_port && r.api_port !== '1812') setApiPort(r.api_port);
        if (r.ip_address && r.ip_address !== r.vendor_config?.nas_ip) setDirectIp(r.ip_address);
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
        body.api_port = 1812;
        body.vendor_config = {
          nas_ip: nasIp,
          radius_secret: radiusSecret
        };
        // NAS IP is the primary IP for RADIUS accounting
        body.ip_address = nasIp;
        // If API credentials were provided, also store them for enhanced monitoring
        if (authUser && authUser !== '(credentials stored)' && authPass) {
          body.username = authUser;
          body.password = authPass;
          // If a separate MikroTik API IP is set, use it
          if (directIp && directIp !== nasIp) body.ip_address = directIp;
          if (apiPort && apiPort !== '1812') body.api_port = apiPort;
        }
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
      <CustomLoader />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/network/routers/${id}`)} className="w-8 h-8 rounded-lg bg-bgSecondary shadow-sm flex items-center justify-center hover:bg-white/5 transition border border-white/10">
          <IconArrowLeft className="w-4 h-4 text-textSecondary" />
        </button>
        <div>
          <h2 className="text-2xl font-medium text-textPrimary">Edit Router</h2>
          <p className="text-[13px] text-textSecondary mt-0.5">Update configuration for {routerName}</p>
        </div>
      </div>

      <div className="bg-bgSecondary rounded-2xl shadow-sm border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
                {vendor === 'mikrotik' 
                 ? <span className="inline-flex items-center text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full"><IconCpu className="w-3.5 h-3.5 mr-1.5" /> MikroTik</span>
                 : <span className="inline-flex items-center text-[12px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full"><IconRouter className="w-3.5 h-3.5 mr-1.5" /> RADIUS NAS</span>
                }
            </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-textPrimary mb-1.5">Router Name</label>
              <input type="text" required value={routerName} onChange={e => setRouterName(e.target.value)} className="auth-input max-w-sm" />
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {vendor === 'mikrotik' && (
            <div className="space-y-6">
              <h3 className="text-[14px] font-semibold text-textPrimary">Connection Details</h3>
              <div className="grid grid-cols-2 gap-5">
                 <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">Connection Type</label>
                    <select value={connType} onChange={e => setConnType(e.target.value)} className="auth-input">
                        <option value="direct">Direct Public IP</option>
                        <option value="wireguard">WireGuard Tunnel</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">IP Address</label>
                    <input type="text" required value={directIp} onChange={e => setDirectIp(e.target.value)} className="auth-input font-mono" />
                 </div>
                 <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">API Port</label>
                    <input type="number" required value={apiPort} onChange={e => setApiPort(e.target.value)} className="auth-input font-mono" />
                 </div>
              </div>
              
              <div className="mt-8">
                  <h3 className="text-[14px] font-semibold text-textPrimary mb-4 flex items-center gap-2"><IconKey className="w-4 h-4 text-textSecondary"/> Update API Credentials</h3>
                  <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 mb-4">
                      <IconAlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-800">Leave these fields blank to keep the existing credentials unchanged. If you are updating credentials, you must provide both the username and password.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                      <div>
                          <label className="block text-[13px] font-medium text-textPrimary mb-1.5">New API Username</label>
                          <input type="text" value={authUser} onChange={e => setAuthUser(e.target.value)} className="auth-input font-mono" placeholder="Leave blank to keep existing" />
                      </div>
                      <div>
                          <label className="block text-[13px] font-medium text-textPrimary mb-1.5">New API Password</label>
                          <input type="password" value={authPass} onChange={e => setAuthPass(e.target.value)} className="auth-input font-mono" placeholder="••••••••" />
                      </div>
                  </div>
              </div>
            </div>
          )}

          {vendor === 'radius' && (
            <div className="space-y-6">
              <h3 className="text-[14px] font-semibold text-textPrimary">RADIUS Configuration</h3>
              <div className="grid grid-cols-2 gap-5">
                 <div className="col-span-2">
                    <label className="block text-[13px] font-medium text-textPrimary mb-0.5">NAS IP Address</label>
                    <p className="text-[11px] text-amber-700 mb-1.5 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                      ⚠️ <strong>Critical:</strong> This must exactly match the source IP that this router sends accounting packets from (visible in server logs as "Incoming"). A mismatch causes sessions to appear on the wrong router or be dropped entirely.
                    </p>
                    <input type="text" value={nasIp} onChange={e => setNasIp(e.target.value)} className="auth-input font-mono max-w-sm" placeholder="e.g. 10.8.0.2 or leave blank for any" />
                 </div>
                 <div className="col-span-2">
                    <label className="block text-[13px] font-medium text-textPrimary mb-0.5">RADIUS Shared Secret</label>
                    <p className="text-[11px] text-textSecondary mb-1.5 pb-1">Must match exactly what is configured on the MikroTik RADIUS client.</p>
                    <input type="text" required value={radiusSecret} onChange={e => setRadiusSecret(e.target.value)} className="auth-input font-mono max-w-sm" />
                 </div>
              </div>

              {/* MikroTik API Enhancement */}
              <div className="border-t border-white/5 pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <IconKey className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-[14px] font-semibold text-textPrimary">
                    MikroTik API Access
                    <span className="ml-2 text-[11px] font-normal text-textSecondary bg-white/10 px-2 py-0.5 rounded-full">Optional — unlocks CPU · Traffic · Kill-switch</span>
                  </h3>
                </div>
                <p className="text-[12px] text-textSecondary mb-4">
                  Provide your MikroTik Winbox credentials to enable live CPU monitoring, per-interface bandwidth, PPPoE session control, and the ability to suspend users directly from the dashboard.
                  Connect via WireGuard tunnel IP or direct public IP on port <strong>8729</strong>.
                </p>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">API IP Address</label>
                    <p className="text-[11px] text-textSecondary mb-1.5">WireGuard tunnel IP or router's public IP.</p>
                    <input type="text" value={directIp} onChange={e => setDirectIp(e.target.value)} className="auth-input font-mono" placeholder="10.8.0.2 or router's public IP" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">API Port</label>
                    <input type="number" value={apiPort === '1812' ? '8729' : apiPort} onChange={e => setApiPort(e.target.value)} className="auth-input font-mono" placeholder="8729" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">API Username</label>
                    <input
                      type="text"
                      value={authUser === '(credentials stored)' ? '' : authUser}
                      onChange={e => setAuthUser(e.target.value)}
                      className="auth-input font-mono"
                      placeholder={authUser === '(credentials stored)' ? '← Credentials already stored' : 'admin'}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-textPrimary mb-1.5">API Password</label>
                    <input
                      type="password"
                      value={authPass}
                      onChange={e => setAuthPass(e.target.value)}
                      className="auth-input font-mono"
                      placeholder={authUser === '(credentials stored)' ? 'Enter new password to update' : '••••••••'}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
             <div className="p-4 bg-rose-50 text-rose-700 text-sm rounded-xl border border-rose-100 flex items-start gap-3">
                 <IconShieldX className="w-5 h-5 shrink-0" />
                 {error}
             </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
             <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
             <button type="submit" disabled={isSaving} className="btn-primary">
                 {isSaving ? <CustomLoader inline size="sm" /> : <IconDeviceFloppy className="w-4 h-4 mr-2" />}
                 Save Changes
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
