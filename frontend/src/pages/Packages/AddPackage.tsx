import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Wifi, Zap, ChevronRight, DollarSign, Clock, ArrowLeft,
  Server, CheckCircle2, XCircle, Loader2, AlertTriangle, Globe, Info
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiClient';
import { SelectDropdown } from '../../components/ui/SelectDropdown';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type VerifyStatus = 'idle' | 'loading' | 'success' | 'error';

interface VerifyResult {
  ppp_profiles:     string[];
  hotspot_profiles: string[];
  found:            boolean;
  warning:          string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AddPackage() {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');
  const [routers, setRouters]   = useState<any[]>([]);
  const [verifyRouterId, setVerifyRouterId] = useState('');
  const [verifyStatus,   setVerifyStatus]   = useState<VerifyStatus>('idle');
  const [verifyResult,   setVerifyResult]   = useState<VerifyResult | null>(null);

  const [form, setForm] = useState({
    display_name:           '',
    service_type:           'PPPoE',
    router_ppp_profile:     '',
    router_hotspot_profile: '',
    speed_down_mbps:        '',
    speed_up_mbps:          '',
    price:                  '',
    billing_cycle_months:   '1',
    validity_days:          '30',
    session_timeout:       '86400',
    description:            ''
    // burst_config intentionally omitted — deprecated, not collected
  });

  const set = (field: string, val: string) => {
    setForm(prev => ({ ...prev, [field]: val }));
    // Reset verify state when the profile name changes
    if (field === 'router_ppp_profile' || field === 'router_hotspot_profile') {
      setVerifyStatus('idle');
      setVerifyResult(null);
    }
  };

  // Fetch routers for the "Verify on Router" dropdown
  useEffect(() => {
    apiFetch('/api/router')
      .then(r => r.json())
      .then(d => setRouters(d.routers || []))
      .catch(() => setRouters([]));
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!form.display_name.trim())    return 'Display Name is required.';
    if (!form.speed_down_mbps)        return 'Download Speed is required.';
    if (!form.speed_up_mbps)          return 'Upload Speed is required.';
    if (!form.price)                  return 'Price is required.';
    if (form.service_type === 'PPPoE' && !form.router_ppp_profile.trim())
      return 'Router PPP Profile is required for PPPoE packages.';
    if (form.service_type === 'Hotspot' && !form.router_hotspot_profile.trim())
      return 'Router Hotspot Profile is required for Hotspot packages.';
    return null;
  };

  // ── Verify Profile on Router ────────────────────────────────────────────────
  // Structured so this can become mandatory in a future phase by changing the
  // validate() check above to include verifyStatus !== 'success'.
  const verifyProfile = async () => {
    const profileName = form.service_type === 'Hotspot'
      ? form.router_hotspot_profile
      : form.router_ppp_profile;

    if (!verifyRouterId) { setError('Select a router to verify against.'); return; }
    if (!profileName.trim()) { setError('Enter a profile name first.'); return; }

    setError('');
    setVerifyStatus('loading');
    setVerifyResult(null);

    try {
      const res  = await apiFetch(
        `/api/router/${verifyRouterId}/profiles?profile_name=${encodeURIComponent(profileName)}`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Router API error');

      const check = data.profile_check || {};
      const found = form.service_type === 'Hotspot' ? check.hotspot_ok : check.pppoe_ok;

      setVerifyStatus(found ? 'success' : 'error');
      setVerifyResult({
        ppp_profiles:     data.ppp_profiles     || [],
        hotspot_profiles: data.hotspot_profiles || [],
        found,
        warning: check.warning || null
      });
    } catch (e: any) {
      setVerifyStatus('error');
      setVerifyResult(null);
      setError(e.message || 'Could not connect to router.');
    }
  };

  // ── Save Package ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const validationErr = validate();
    if (validationErr) { setError(validationErr); return; }

    setError('');
    setLoading(true);

    try {
      // Get the current user's profile to retrieve their tenant_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setError("Your session has expired. Please log in again.");
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        setLoading(false);
        setError("Tenant configuration missing. Contact support.");
        return;
      }

      const { error: err } = await supabase.from('packages').insert([{
        tenant_id:              profile.tenant_id, // STRICT ISOLATION
        display_name:           form.display_name,
        service_type:           form.service_type,
        router_ppp_profile:     form.router_ppp_profile     || null,
        router_hotspot_profile: form.router_hotspot_profile || null,
        speed_down_mbps:        parseFloat(form.speed_down_mbps),
        speed_up_mbps:          parseFloat(form.speed_up_mbps),
        price:                  parseFloat(form.price),
        billing_cycle_months:   parseInt(form.billing_cycle_months),
        validity_days:          parseInt(form.validity_days),
        session_timeout:        parseInt(form.session_timeout),
        description:            form.description || null,
        is_active:              true
        // burst_config not included — deprecated
      }]);

      if (err) throw err;
      navigate('/packages');
    } catch (e: any) {
      setError(e.message || 'Failed to create package. Ensure the database migration 003 has been applied.');
    } finally {
      setLoading(false);
    }
  };

  // ── Profile field for current service_type ──────────────────────────────────
  const activeProfileField = form.service_type === 'Hotspot'
    ? 'router_hotspot_profile'
    : 'router_ppp_profile';

  const activeProfileValue = form.service_type === 'Hotspot'
    ? form.router_hotspot_profile
    : form.router_ppp_profile;

  const activeProfileLabel = form.service_type === 'Hotspot'
    ? 'Router Hotspot Profile'
    : 'Router PPP Profile';

  const profilePlaceholder = form.service_type === 'Hotspot'
    ? 'e.g. hs-10M (exact name from RouterOS)'
    : 'e.g. 10Mbps (exact name from RouterOS)';

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/packages')}
          className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div>
          <h2 className="text-[18px] font-medium text-slate-800">Create Internet Package</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Define bandwidth limits, pricing, and RouterOS profile bindings.
          </p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">

          {/* ── Service Architecture ──────────────────────────────────────────── */}
          <div>
            <label className="block text-[12px] font-medium text-slate-500 mb-3 uppercase tracking-wide">
              Service Architecture
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'PPPoE',   icon: Shield, desc: 'Username/password authenticated tunnel' },
                { type: 'Hotspot', icon: Wifi,   desc: 'Captive portal / voucher-based access' },
                { type: 'Static',  icon: Globe,  desc: 'Fixed IP — no RouterOS profile needed' }
              ].map(({ type, icon: Icon, desc }) => (
                <label
                  key={type}
                  className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col gap-2 ${
                    form.service_type === type
                      ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio" value={type}
                    checked={form.service_type === type}
                    onChange={e => { set('service_type', e.target.value); setVerifyStatus('idle'); setVerifyResult(null); }}
                    className="sr-only"
                  />
                  <Icon className={`w-5 h-5 ${form.service_type === type ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{type}</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* ── Display Name ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
              Display Name *
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={e => set('display_name', e.target.value)}
              className="input-field"
              placeholder="e.g. Home Broadband 10Mbps"
            />
            <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Used in billing UI and customer lists only. Not sent to the router.
            </p>
          </div>

          {/* ── Router Profile Section (hidden for Static) ───────────────────── */}
          {form.service_type !== 'Static' && (
            <div className="rounded-xl border border-slate-200 p-5 space-y-4 bg-slate-50/40">
              <div>
                <p className="text-[13px] font-semibold text-slate-800 mb-0.5">Router Profile Binding</p>
                <p className="text-[12px] text-slate-500">
                  This is the exact profile name that will be applied to RouterOS during provisioning.
                  It must match <span className="font-mono bg-slate-200 px-1 rounded text-slate-700">
                  {form.service_type === 'Hotspot' ? '/ip/hotspot/user/profile' : '/ppp/profile'}
                  </span> on the router.
                </p>
              </div>

              {/* Profile name input */}
              <div>
                <label className="block text-[12px] font-medium text-slate-600 mb-2 uppercase tracking-wide">
                  {activeProfileLabel} *
                </label>
                <input
                  type="text"
                  value={activeProfileValue}
                  onChange={e => set(activeProfileField, e.target.value)}
                  className="input-field font-mono"
                  placeholder={profilePlaceholder}
                />
              </div>

              {/* Verify on Router */}
              <div className="space-y-3">
                <label className="block text-[12px] font-medium text-slate-600 mb-2 uppercase tracking-wide">
                  Verify Profile on Router (Optional)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Server className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10 pointer-events-none" />
                    <SelectDropdown
                      value={verifyRouterId}
                      onChange={(val) => { setVerifyRouterId(val); setVerifyStatus('idle'); setVerifyResult(null); }}
                      options={routers.map((r: any) => ({ label: `${r.name} (${r.ip_address})`, value: r.id }))}
                      placeholder="— Select router to test against —"
                      icon={<Server className="w-4 h-4" />}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={verifyProfile}
                    disabled={verifyStatus === 'loading' || !verifyRouterId || !activeProfileValue.trim()}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-[13px] font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition flex items-center gap-2 whitespace-nowrap"
                  >
                    {verifyStatus === 'loading'
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                      : 'Verify Profile'}
                  </button>
                </div>

                {/* Verify result */}
                {verifyStatus === 'success' && verifyResult && (
                  <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-[13px]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Profile <span className="font-mono font-semibold mx-1">{activeProfileValue}</span> confirmed on router.
                  </div>
                )}

                {verifyStatus === 'error' && verifyResult && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2 text-amber-800 text-[13px]">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{verifyResult.warning || `Profile '${activeProfileValue}' not found on selected router.`}</span>
                    </div>
                    {/* Available profiles list — prepared for future dropdown-based selection */}
                    {(form.service_type === 'Hotspot' ? verifyResult.hotspot_profiles : verifyResult.ppp_profiles).length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-amber-800 mb-2 uppercase tracking-wide">
                          Available profiles on this router:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(form.service_type === 'Hotspot' ? verifyResult.hotspot_profiles : verifyResult.ppp_profiles).map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => { set(activeProfileField, p); setVerifyStatus('idle'); setVerifyResult(null); }}
                              className="font-mono text-[11px] bg-white border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">Click a profile above to auto-fill the field.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Speed & Pricing ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Download Speed (Mbps) *
              </label>
              <div className="relative">
                <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="number" min="0.1" step="0.1"
                  value={form.speed_down_mbps}
                  onChange={e => set('speed_down_mbps', e.target.value)}
                  className="pl-10 input-field font-mono"
                  placeholder="10"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Upload Speed (Mbps) *
              </label>
              <div className="relative">
                <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="number" min="0.1" step="0.1"
                  value={form.speed_up_mbps}
                  onChange={e => set('speed_up_mbps', e.target.value)}
                  className="pl-10 input-field font-mono"
                  placeholder="5"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Monthly Price (Ksh) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="number" min="0"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  className="pl-10 input-field font-mono"
                  placeholder="2500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Billing Cycle
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none z-10" />
                <SelectDropdown
                  value={form.billing_cycle_months}
                  onChange={val => set('billing_cycle_months', val)}
                  options={[
                    { label: 'Monthly (30 days)',       value: '1' },
                    { label: 'Quarterly (3 months)',    value: '3' },
                    { label: 'Semi-Annual (6 months)',  value: '6' },
                    { label: 'Annual (12 months)',      value: '12' }
                  ]}
                  icon={<Clock className="w-4 h-4" />}
                />
              </div>
            </div>

            {/* Validity Days — shown for Hotspot */}
            {form.service_type === 'Hotspot' && (
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  Validity (Days)
                </label>
                <input
                  type="number" min="1"
                  value={form.validity_days}
                  onChange={e => set('validity_days', e.target.value)}
                  className="input-field font-mono"
                  placeholder="30"
                />
              </div>
            )}

            {/* Session Timeout — shown for RADIUS/PPPoE/Hotspot */}
            {form.service_type !== 'Static' && (
              <div>
                <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  RADIUS Session Timeout
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none z-10" />
                  <SelectDropdown
                    value={form.session_timeout}
                    onChange={val => set('session_timeout', val)}
                    options={[
                      { label: '24 Hours (86400s) — Recommended', value: '86400' },
                      { label: '7 Days (604800s)',                value: '604800' },
                      { label: '30 Days (2592000s)',               value: '2592000' }
                    ]}
                    icon={<Clock className="w-4 h-4" />}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Forces PPPoE re-authentication at this interval.
                </p>
              </div>
            )}

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Description (Optional)
              </label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                className="input-field resize-none"
                placeholder="Internal notes about this package..."
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700 flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50/50 border-t border-slate-200/60 flex justify-between items-center px-6 md:px-8">
          <button
            onClick={() => navigate('/packages')}
            className="text-[13px] font-medium text-slate-500 hover:text-slate-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex items-center"
          >
            {loading ? 'Saving...' : <><span>Deploy Package</span><ChevronRight className="w-4 h-4 ml-1" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
