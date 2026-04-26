import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  ArrowLeft, User, Phone, Mail, MapPin, CreditCard, 
  Wifi, Shield, Server, Activity, CalendarClock, History,
  Loader2, Globe, Clock, CheckCircle2, AlertCircle, Edit3, X
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  // Authentication Edit State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Activity Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCustomer(id);
      fetchLogs(id);
    }
  }, [id]);

  const triggerToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLogs = async (customerId: string) => {
    setLoadingLogs(true);
    try {
      const res = await apiFetch(`/api/services/${customerId}/logs`);
      const data = await res.json();
      if (data.success) setLogs(data.logs || []);
    } catch (e) {
      console.error("Failed to fetch logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setSavingPassword(true);
    try {
      const res = await apiFetch(`/api/services/${id}/password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Authentication password successfully updated on Router and Database.');
        setShowPasswordModal(false);
        setNewPassword('');
      } else {
        triggerToast(data.error || 'Failed to change password.', 'error');
      }
    } catch (e: any) {
      triggerToast('Server connection failed.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const fetchCustomer = async (customerId: string) => {
    setLoading(true);
    
    // Get the current user's profile to retrieve their tenant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profileData?.tenant_id) {
       console.error("Tenant configuration missing.");
       setLoading(false);
       return;
    }

    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        persons ( id, full_name, phone, email ),
        packages ( id, display_name, speed_down_mbps, speed_up_mbps, price, service_type ),
        routers ( id, name, ip_address ),
        units ( id, unit_number, properties ( id, name, location ) )
      `)
      .eq('id', customerId)
      .eq('tenant_id', profileData.tenant_id) // STRICT ISOLATION
      .single();

    if (!error && data) {
      const unit = (data.units as any);
      const property = unit?.properties;
      const addressParts = [
        property?.name,
        unit?.unit_number ? `Unit ${unit.unit_number}` : null,
        property?.location,
      ].filter(Boolean);

      setCustomer({
        ...data,
        full_name: (data.persons as any)?.full_name || 'Unknown',
        phone: (data.persons as any)?.phone || '—',
        email: (data.persons as any)?.email || null,
        installation_address: addressParts.length > 0 ? addressParts.join(', ') : null,
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-32">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-sm font-medium text-textSecondary">Loading profile data...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center p-32 text-center">
        <User className="w-12 h-12 text-textSecondary mb-4" />
        <h2 className="text-lg font-medium text-textPrimary">Customer Not Found</h2>
        <p className="text-sm text-textSecondary max-w-sm mt-2 mb-6">The requested subscriber profile does not exist or has been deleted.</p>
        <button onClick={() => navigate('/customers/all')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
        </button>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'suspended': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-white/10 text-textSecondary border-white/10';
    }
  };

  const isPositiveBalance = parseFloat(customer.balance) > 0;
  const isNegativeBalance = parseFloat(customer.balance) < 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10 relative">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 text-[13px] font-medium px-4 py-3 rounded-xl shadow-lg border animate-in fade-in slide-in-from-top-2 flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          {toast.msg}
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-bgPrimary/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bgSecondary rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[16px] font-semibold text-textPrimary">Change Authentication Password</h3>
              <button disabled={savingPassword} onClick={() => setShowPasswordModal(false)} className="text-textSecondary hover:text-textSecondary"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="mb-6">
                <label className="block text-[12px] font-medium text-textPrimary mb-1.5">New PPPoE / Hotspot Password</label>
                <input 
                  type="text" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input-field w-full font-mono"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-textSecondary mt-2">
                  This will instantly override the customer's secret profile on the MikroTik router. They may be temporarily disconnected during the sync.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="btn-secondary w-full" disabled={savingPassword}>Cancel</button>
                <button type="submit" className="btn-primary w-full shadow-md shadow-emerald-500/20" disabled={savingPassword || !newPassword.trim()}>
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Push to Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers/all')} className="w-10 h-10 flex items-center justify-center rounded-xl bg-bgSecondary shadow-sm border border-white/10 hover:bg-white/5 text-textSecondary transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-textPrimary">{customer.full_name}</h1>
            <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full border capitalize ${statusBadge(customer.status)}`}>
              {customer.status}
            </span>
          </div>
          <p className="text-sm text-textSecondary font-mono mt-1">ACC: {customer.account_number}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <button 
            onClick={() => navigate(`/customers/edit/${id}`)}
            className="btn-secondary flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="card">
          <h3 className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider mb-4 flex items-center gap-2 pt-1">
            <User className="w-3.5 h-3.5" /> Identity & Contact
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-textSecondary mt-0.5" />
              <div>
                <p className="text-xs text-textSecondary mb-0.5">Phone Number</p>
                <p className="text-sm font-medium text-textPrimary">{customer.phone}</p>
              </div>
            </div>
            {customer.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-textSecondary mt-0.5" />
                <div>
                  <p className="text-xs text-textSecondary mb-0.5">Email Address</p>
                  <p className="text-sm font-medium text-textPrimary">{customer.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-textSecondary mt-0.5" />
              <div>
                <p className="text-xs text-textSecondary mb-0.5">Installation Location</p>
                <p className="text-sm font-medium text-textPrimary">
                  {customer.installation_address || 'Address not stored on customer record'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="card">
          <h3 className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider mb-4 flex items-center gap-2 pt-1">
            <CreditCard className="w-3.5 h-3.5" /> Financial Standing
          </h3>
          <div className="space-y-5">
            <div>
              <p className="text-xs text-textSecondary mb-1">Current Balance</p>
              <p className={`text-2xl font-bold flex items-baseline gap-1 ${isPositiveBalance ? 'text-rose-600' : isNegativeBalance ? 'text-emerald-600' : 'text-textPrimary'}`}>
                <span className="text-sm font-medium text-textSecondary">Ksh</span> 
                {Math.abs(parseFloat(customer.balance)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                {isNegativeBalance && <span className="text-xs font-semibold px-2 ml-2 bg-emerald-100 text-emerald-700 rounded-full py-0.5 align-middle">CR</span>}
              </p>
            </div>
            
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="flex items-start gap-3">
                <CalendarClock className="w-4 h-4 text-emerald-500 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-textPrimary">Next Renewal Date</p>
                  <p className="text-sm font-medium text-emerald-700 mt-0.5">
                    {new Date(customer.next_due_date).toLocaleDateString('en-KE', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technical */}
        <div className="card">
          <h3 className="text-[11px] font-semibold text-textSecondary uppercase tracking-wider mb-4 flex items-center gap-2 pt-1">
            <Activity className="w-3.5 h-3.5" /> Provisioning
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Wifi className="w-4 h-4 text-textSecondary mt-0.5" />
              <div>
                <p className="text-xs text-textSecondary mb-0.5">Active Package</p>
                <p className="text-sm font-medium text-textPrimary">
                  {customer.packages ? customer.packages.display_name : 'No Package Assigned'}
                </p>
                {customer.packages && (
                  <p className="text-[11px] font-mono text-textSecondary mt-1">
                    {customer.packages.speed_down_mbps}Mbps ↓ / {customer.packages.speed_up_mbps}Mbps ↑
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-textSecondary mt-0.5" />
              <div>
                <p className="text-xs text-textSecondary mb-0.5">Authentication ({customer.service_type || 'PPPoE'})</p>
                <div className="flex items-center justify-between group">
                  <p className="text-sm font-medium text-textPrimary font-mono">
                    {customer.username || 'No credentials'}
                  </p>
                  <button onClick={() => setShowPasswordModal(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1 hover:bg-emerald-100">
                    <Edit3 className="w-3 h-3" /> Edit Password
                  </button>
                </div>
                {customer.ip_address && (
                  <p className="text-[11px] font-mono text-textSecondary mt-1">IP: {customer.ip_address}</p>
                )}
              </div>
            </div>
            {customer.routers && (
              <div className="flex items-start gap-3">
                <Server className="w-4 h-4 text-textSecondary mt-0.5" />
                <div>
                  <p className="text-xs text-textSecondary mb-0.5">Provisioned Router</p>
                  <p className="text-sm font-medium text-textPrimary">
                    {customer.routers.name}
                  </p>
                  <p className="text-[11px] font-mono text-textSecondary mt-1">{customer.routers.ip_address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Logs (Full Width) */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-[14px] font-semibold text-textPrimary flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-500" /> Live Router Activity Logs
            </h3>
            <p className="text-[12px] text-textSecondary mt-0.5">Direct telemetry matching '{customer.username}' from the MikroTik buffer.</p>
          </div>
          <button onClick={() => fetchLogs(id!)} className="btn-secondary text-[11px] px-3 py-1 flex flex-row gap-1 border border-white/10">
            <Activity className="w-3.5 h-3.5" /> Refresh Cache
          </button>
        </div>

        {loadingLogs ? (
          <div className="flex flex-col items-center justify-center p-10">
            <Loader2 className="w-6 h-6 text-textSecondary animate-spin mb-3" />
            <p className="text-[12px] text-textSecondary">Querying RouterOS Buffer...</p>
          </div>
        ) : !logs.length ? (
          <div className="text-center p-10 bg-white/5 rounded-xl border border-white/5 border-dashed">
            <p className="text-[13px] text-textSecondary">No recent activity detected in the router's current boot log buffer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-3 text-[11px] font-semibold text-textSecondary tracking-wider">Timestamp</th>
                  <th className="pb-3 text-[11px] font-semibold text-textSecondary tracking-wider">Log Topics</th>
                  <th className="pb-3 text-[11px] font-semibold text-textSecondary tracking-wider">Message Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log, idx) => (
                  <tr key={log['.id'] || idx} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 text-[12px] text-textSecondary font-mono w-40">{log.time || '—'}</td>
                    <td className="py-2.5 text-[11px] text-textSecondary uppercase tracking-widest w-48">{log.topics || 'SYSTEM'}</td>
                    <td className="py-2.5 text-[13px] text-textPrimary font-mono">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
