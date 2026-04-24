import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Building, CreditCard, Bell, Shield, PaintBucket, Save, Info, User, Lock, CheckCircle2, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { supabase } from '../lib/supabase';
import { validatePhone, validateEmail } from '../lib/validation';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Company Profile');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ok: boolean, msg: string} | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [diagReport, setDiagReport] = useState<any>(null);
  const [runningDiag, setRunningDiag] = useState(false);

  // Admin Profile State
  const [profile, setProfile] = useState({ display_name: '', email: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change State
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);

  const triggerToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [company, setCompany] = useState({ name: '', phone: '', address: '', email: '' });
  const [theme, setTheme] = useState({ primary_color: '#10b981', portal_domain: '', hide_branding: false });
  const [billing, setBilling] = useState({
    mpesa_paybill: '', mpesa_account_ref: '', mpesa_consumer_key: '', mpesa_consumer_secret: '', mpesa_passkey: '',
    ipn_url: 'https://yourdomain.com/api/mpesa/callback',
    grace_period_hours: '48', auto_suspend: true, auto_renewal_days: '3'
  });

  const setB = (k: string, v: any) => setBilling(prev => ({ ...prev, [k]: v }));
  const setC = (k: string, v: string) => setCompany(prev => ({ ...prev, [k]: v }));
  const setT = (k: string, v: any) => setTheme(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    // Load system settings
    apiFetch('/api/settings')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load settings');
        return res.json();
      })
      .then(data => {
         if (data.success && data.settings) {
             const s = data.settings;
             setC('name', s.company_name || '');
             setC('phone', s.company_phone || '');
             setC('address', s.company_address || '');
             setC('email', s.company_email || '');
             
             setT('primary_color', s.primary_color || '#10b981');
             setT('portal_domain', s.portal_domain || '');
             setT('hide_branding', s.hide_branding === 'true');
             
             setB('mpesa_paybill', s.mpesa_paybill || '');
             setB('mpesa_account_ref', s.mpesa_account_ref || '');
             setB('mpesa_consumer_key', s.mpesa_consumer_key || '');
             setB('mpesa_consumer_secret', s.mpesa_consumer_secret || '');
             setB('mpesa_passkey', s.mpesa_passkey || '');
             setB('ipn_url', s.ipn_url || 'https://yourdomain.com/api/mpesa/callback');
         }
      })
      .catch(e => {
        triggerToast('Failed to load system configuration.', 'error');
        console.error(e);
      });

    // Load logged-in admin profile
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setProfile({
          display_name: data.user.user_metadata?.full_name || '',
          email: data.user.email || ''
        });
      }
    });
  }, []);

  const handleSave = async () => {
    // Validation
    if (company.phone && !validatePhone(company.phone)) {
        triggerToast('Invalid company phone number format.', 'error');
        return;
    }
    if (company.email && !validateEmail(company.email)) {
        triggerToast('Invalid company email format.', 'error');
        return;
    }

    const payload = [
        { key: 'company_name', value: company.name },
        { key: 'company_phone', value: company.phone },
        { key: 'company_address', value: company.address },
        { key: 'company_email', value: company.email },
        { key: 'primary_color', value: theme.primary_color },
        { key: 'portal_domain', value: theme.portal_domain },
        { key: 'hide_branding', value: String(theme.hide_branding) },
        { key: 'mpesa_paybill', value: billing.mpesa_paybill },
        { key: 'mpesa_account_ref', value: billing.mpesa_account_ref },
        { key: 'mpesa_consumer_key', value: billing.mpesa_consumer_key },
        { key: 'mpesa_consumer_secret', value: billing.mpesa_consumer_secret },
        { key: 'mpesa_passkey', value: billing.mpesa_passkey },
        { key: 'ipn_url', value: billing.ipn_url },
        { key: 'grace_period_hours', value: billing.grace_period_hours },
        { key: 'auto_renewal_days', value: billing.auto_renewal_days }
    ];

    try {
        const res = await apiFetch('/api/settings/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: payload })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save settings');
        }

        setSaved(true);
        triggerToast('Configuration updated successfully.');
        setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
        triggerToast(e.message || "Failed to save settings", "error");
        console.error("Save Error:", e);
    }
  };

  const handleTestMpesa = async () => {
      setTesting(true);
      setTestResult(null);
      try {
          const res = await apiFetch('/api/settings/test-mpesa', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ consumerKey: billing.mpesa_consumer_key, consumerSecret: billing.mpesa_consumer_secret })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Test failed');
          setTestResult({ ok: true, msg: data.message });
      } catch (e: any) {
          setTestResult({ ok: false, msg: e.message });
      }
      setTesting(false);
  };

  const handleRunDiag = async () => {
    setRunningDiag(true);
    setDiagReport(null);
    try {
        const res = await apiFetch('/api/settings/diagnostics');
        const data = await res.json();
        setDiagReport(data.report);
    } catch (e: any) {
        triggerToast('Diagnostics failed to run.', 'error');
    } finally {
        setRunningDiag(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.email && !validateEmail(profile.email)) {
      triggerToast('Invalid admin email format.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const updates: any = { data: { full_name: profile.display_name } };
      if (profile.email) updates.email = profile.email;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      triggerToast('Account profile updated successfully.');
    } catch (e: any) {
      triggerToast(e.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      triggerToast('New passwords do not match.', 'error');
      return;
    }
    if (pwForm.newPw.length < 8) {
      triggerToast('Password must be at least 8 characters.', 'error');
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw });
      if (error) throw error;
      triggerToast('Password changed successfully. Please log in again on other devices.');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (e: any) {
      triggerToast(e.message || 'Failed to change password.', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const tabs = [
    { name: 'Company Profile',        icon: Building    },
    { name: 'Billing & IPN Rules',    icon: CreditCard  },
    { name: 'Communication Specs',    icon: Bell        },
    { name: 'Authentication Struct',  icon: Shield      },
    { name: 'Theme & Whitelabel',     icon: PaintBucket },
  ];

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Global Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 text-[13px] font-medium px-4 py-3 rounded-xl shadow-lg border animate-in fade-in slide-in-from-top-2 flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          {toast.msg}
        </div>
      )}
      <div className="mb-8">
        <h2 className="text-[20px] font-medium text-slate-800">System Configuration</h2>
        <p className="text-[13px] text-slate-500 mt-1">Configure platform behavior, M-Pesa IPN callbacks, and branding.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="md:col-span-1 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-[13px] font-medium transition-all ${activeTab === tab.name ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <tab.icon className={`w-4 h-4 mr-3 ${activeTab === tab.name ? 'text-white' : 'text-slate-400'}`} />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Form Panel */}
        <div className="md:col-span-3 card space-y-6 animate-in fade-in duration-300">

          {/* COMPANY PROFILE */}
          {activeTab === 'Company Profile' && (
            <div className="space-y-6">
              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4">Company Details</h3>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Company Name</label>
                  <input type="text" value={company.name} onChange={e => setC('name', e.target.value)} className="input-field" placeholder="Movec Connect Ltd" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Support Phone</label>
                  <input type="text" value={company.phone} onChange={e => setC('phone', e.target.value)} className="input-field font-mono" placeholder="+254 700 000 000" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Support Email</label>
                  <input type="email" value={company.email} onChange={e => setC('email', e.target.value)} className="input-field" placeholder="support@yourcompany.co.ke" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">HQ Address</label>
                  <input type="text" value={company.address} onChange={e => setC('address', e.target.value)} className="input-field" placeholder="Westlands, Nairobi" />
                </div>
              </div>

              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4 mt-2">Automation Rules</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                  <div>
                    <h4 className="font-medium text-slate-800 text-[14px]">Auto Suspension</h4>
                    <p className="text-[12px] text-slate-500 mt-0.5">Suspend accounts automatically after grace period expires.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                  <div>
                    <h4 className="font-medium text-slate-800 text-[14px]">Grace Period</h4>
                    <p className="text-[12px] text-slate-500 mt-0.5">Hours before strict suspension after due date.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" defaultValue="48" className="input-field w-20 text-center font-medium" />
                    <span className="text-[12px] text-slate-400">hours</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BILLING & IPN RULES */}
          {activeTab === 'Billing & IPN Rules' && (
            <div className="space-y-6">
              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4">M-Pesa Daraja Configuration</h3>

              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-blue-800">IPN Callback URL</p>
                  <p className="text-[12px] text-blue-700 mt-0.5">Register this URL on your <strong>Daraja App → STK Push → Callback URL</strong>:</p>
                  <code className="block mt-2 font-mono text-[11px] bg-blue-100 text-blue-900 px-3 py-2 rounded-lg">{billing.ipn_url}</code>
                  <p className="text-[11px] text-blue-600 mt-1.5">The backend will auto-match payments by phone number and update customer balances.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">M-Pesa Paybill / Till</label>
                  <input type="text" value={billing.mpesa_paybill} onChange={e => setB('mpesa_paybill', e.target.value)} className="input-field font-mono" placeholder="247247" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Account Reference</label>
                  <input type="text" value={billing.mpesa_account_ref} onChange={e => setB('mpesa_account_ref', e.target.value)} className="input-field font-mono" placeholder="e.g. Account Number" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Daraja Consumer Key</label>
                  <input type="text" value={billing.mpesa_consumer_key} onChange={e => setB('mpesa_consumer_key', e.target.value)} className="input-field font-mono" placeholder="From Daraja App" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Daraja Consumer Secret</label>
                  <input type="password" value={billing.mpesa_consumer_secret} onChange={e => setB('mpesa_consumer_secret', e.target.value)} className="input-field font-mono" placeholder="●●●●●●●●●●●●" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Daraja Passkey (For STK Push)</label>
                  <input type="password" value={billing.mpesa_passkey} onChange={e => setB('mpesa_passkey', e.target.value)} className="input-field font-mono" placeholder="●●●●●●●●●●●●" />
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-4 mb-2">
                 <button onClick={handleTestMpesa} disabled={testing} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 border border-blue-200 rounded-lg text-[13px] font-medium transition">
                    {testing ? 'Testing...' : 'Test Connection'}
                 </button>
                 {testResult && (
                     <span className={`text-[12px] font-medium ${testResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                         {testResult.msg}
                     </span>
                 )}
              </div>

              {/* INTEGRITY DIAGNOSTICS */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl mt-4">
                 <div className="flex items-center justify-between mb-4">
                    <div>
                        <h4 className="text-[14px] font-semibold text-slate-800">Configuration Integrity Check</h4>
                        <p className="text-[12px] text-slate-500 mt-0.5">Verify that your encrypted keys are readable by the server.</p>
                    </div>
                    <button onClick={handleRunDiag} disabled={runningDiag} className="bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg text-[12px] font-medium transition shadow-sm">
                        {runningDiag ? 'Running...' : 'Run Diagnostics'}
                    </button>
                 </div>

                 {diagReport && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="grid grid-cols-2 gap-2">
                           <div className="p-3 bg-white rounded-xl border border-slate-100">
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Database Rows</p>
                              <p className="text-[15px] font-mono font-bold text-slate-700">{diagReport.total_rows_in_db}</p>
                           </div>
                           <div className="p-3 bg-white rounded-xl border border-slate-100">
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tenant ID Reference</p>
                              <p className="text-[11px] font-mono text-slate-500 truncate" title={diagReport.tenant_id}>{diagReport.tenant_id}</p>
                           </div>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-slate-100 space-y-2">
                           <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sensitive Keys Integrity</p>
                           {Object.entries(diagReport.sensitive_keys_status).map(([key, status]: any) => (
                              <div key={key} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                                 <span className="text-[12px] font-mono text-slate-600">{key}</span>
                                 <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                    status === 'LOADED_AND_DECRYPTED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                 }`}>
                                    {status}
                                 </span>
                              </div>
                           ))}
                        </div>
                    </div>
                 )}
              </div>

              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4 mt-2">Billing Cycle Rules</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                  <div>
                    <h4 className="font-medium text-slate-800 text-[14px]">Pre-expiry Renewal Reminder</h4>
                    <p className="text-[12px] text-slate-500 mt-0.5">Days before due date to send payment reminder to customer.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={billing.auto_renewal_days} onChange={e => setB('auto_renewal_days', e.target.value)} className="input-field w-16 text-center font-medium" />
                    <span className="text-[12px] text-slate-400">days</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                  <div>
                    <h4 className="font-medium text-slate-800 text-[14px]">Auto-Reconnect on Payment</h4>
                    <p className="text-[12px] text-slate-500 mt-0.5">Automatically re-enable suspended accounts when IPN confirms payment received.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* COMMUNICATION */}
          {activeTab === 'Communication Specs' && (
            <div className="space-y-6">
              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4">SMS Gateway — Celcom Africa</h3>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Celcom Partner ID</label>
                  <input type="text" className="input-field font-mono" placeholder="e.g. 1234" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Celcom API Key</label>
                  <input type="password" className="input-field font-mono" placeholder="●●●●●●●●●●●●●" />
                </div>
              </div>

              {/* Sender ID type */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-3 uppercase tracking-wide">Sender ID Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="cursor-pointer rounded-xl border border-emerald-500 bg-emerald-50/50 p-4 flex items-start gap-3">
                    <input type="radio" name="sender_type" defaultChecked className="mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-emerald-700">Shared Sender ID</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Use our platform shortcode. No registration needed. Available immediately.</p>
                      <span className="inline-block mt-2 text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">MOVEC</span>
                    </div>
                  </label>
                  <label className="cursor-pointer rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:border-slate-300">
                    <input type="radio" name="sender_type" className="mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-slate-700">Custom Sender ID</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Register your own brand name as sender. Requires Celcom approval (3-5 days).</p>
                      <input type="text" className="mt-2 w-full px-2 py-1 text-[12px] font-mono border border-slate-200 rounded-lg" placeholder="Your Brand ID" />
                    </div>
                  </label>
                </div>
              </div>

              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4 mt-2">WhatsApp Business (Meta Cloud API)</h3>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Business Name</label>
                  <input type="text" className="input-field" placeholder="e.g. Movec Connect Ltd" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Phone Number ID</label>
                  <input type="text" className="input-field font-mono" placeholder="From Meta Business Manager" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Permanent Access Token</label>
                  <input type="password" className="input-field font-mono" placeholder="EAAxxxxxxxxxxxx" />
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                <p className="text-[12px] font-medium text-slate-700 mb-1">Message Templates</p>
                <p className="text-[11px] text-slate-500">WhatsApp Business requires pre-approved message templates for outbound initiation. Free-form text is only available within 24h of a customer message. Manage templates in the <a href="https://business.facebook.com" target="_blank" className="text-emerald-600 underline">Meta Business Manager</a>.</p>
              </div>
            </div>
          )}

          {/* AUTHENTICATION STRUCT — Admin Account Panel */}
          {activeTab === 'Authentication Struct' && (
            <div className="space-y-8">

              {/* Admin Profile */}
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-500" /> Admin Identity
                </h3>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Display Name</label>
                    <input
                      type="text"
                      value={profile.display_name}
                      onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
                      className="input-field"
                      placeholder="e.g. Kevin Mwendwa"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Admin Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                      className="input-field"
                      placeholder="you@company.co.ke"
                      required
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">A confirmation link will be sent to the new email address before it takes effect.</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingProfile}>
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                    Save Identity
                  </button>
                </div>
              </form>

              {/* Change Password */}
              <form onSubmit={handleChangePassword} className="space-y-5">
                <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" /> Change Admin Password
                </h3>
                <div className="space-y-4">
                  {(['current', 'newPw', 'confirm'] as const).map((field, i) => (
                    <div key={field}>
                      <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">
                        {field === 'current' ? 'Current Password' : field === 'newPw' ? 'New Password' : 'Confirm New Password'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPw[field] ? 'text' : 'password'}
                          value={pwForm[field]}
                          onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                          className="input-field w-full pr-10 font-mono"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPw[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">
                  ⚠️ Changing your password will not terminate existing active sessions on other devices — but future logins will require the new password.
                </div>
                <div className="flex justify-start">
                  <button type="submit" className="btn-primary flex items-center gap-2" disabled={savingPw || !pwForm.newPw}>
                    {savingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* THEME & WHITELABEL */}
          {activeTab === 'Theme & Whitelabel' && (
            <div className="space-y-6">
              <h3 className="text-[15px] font-medium text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
                <PaintBucket className="w-4 h-4 text-emerald-500" /> Branding & Whitelabel
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Brand Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={theme.primary_color} onChange={e => setT('primary_color', e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0 shadow-sm" />
                    <input type="text" value={theme.primary_color} onChange={e => setT('primary_color', e.target.value)} className="input-field font-mono max-w-[120px]" />
                  </div>
                  <p className="text-[11px] text-slate-400">Used for customer portal buttons and highlights.</p>
                </div>
                
                <div className="space-y-3">
                   <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wide">Customer Portal Domain</label>
                   <input type="text" value={theme.portal_domain} onChange={e => setT('portal_domain', e.target.value)} className="input-field font-mono" placeholder="myisp.movec.app" />
                   <p className="text-[11px] text-slate-400">Custom CNAME for your self-care portal.</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border border-slate-200/60 rounded-xl flex items-center justify-between mt-4">
                <div>
                  <h4 className="font-medium text-slate-800 text-[14px]">Remove "Powered by Movec"</h4>
                  <p className="text-[12px] text-slate-500 mt-0.5">Hides the default vendor branding on customer-facing pages.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={theme.hide_branding} onChange={e => setT('hide_branding', e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-3 mt-4">
                <Info className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-[12px] text-blue-800 leading-relaxed">
                  <strong>Looking for Custom Logos?</strong> Image asset uploading is currently managed directly by your account manager. Please reach out to <a href="mailto:support@movec.co" className="underline font-semibold">support@movec.co</a> to update your invoices and portal company logo.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button onClick={handleSave} className={`btn-primary flex items-center transition-all ${saved ? 'bg-emerald-600' : ''}`}>
              <Save className="w-4 h-4 mr-2" />
              {saved ? 'Saved!' : 'Update Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
