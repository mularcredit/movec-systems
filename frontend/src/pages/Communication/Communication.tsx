import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, Send, Users, Clock, CheckCircle2, XCircle,
  Loader2, Smartphone, MessageCircle, ChevronDown, RefreshCw,
  Zap, AlertTriangle, Search, X, BarChart3
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiClient';

const API = '/api/comms';

const TEMPLATES = [
  { label: 'Payment Due Reminder', icon: '💳', body: 'Dear {name}, your internet subscription expires on {due_date}. Kindly renew to avoid service interruption. Acct: {account}.' },
  { label: 'Payment Received', icon: '✅', body: 'Dear {name}, we have received your payment. Your subscription is active until {due_date}. Thank you for choosing us.' },
  { label: 'Service Suspended', icon: '⛔', body: 'Dear {name}, your account {account} has been suspended due to non-payment. Pay now to restore access immediately.' },
  { label: 'Account Reconnected', icon: '🔄', body: 'Dear {name}, your internet service has been restored. Welcome back! Your new expiry is {due_date}.' },
  { label: 'Welcome Message', icon: '👋', body: 'Welcome to our network, {name}! Your account number is {account}. For support, WhatsApp or call us anytime.' },
  { label: 'Renewal Discount', icon: '🎁', body: 'Dear {name}, renew your plan this week and get a free 3-day extension! Expires {due_date}. Pay via Paybill.' },
];

const FILTERS = [
  { value: 'all',       label: 'All Customers',       icon: Users,         color: 'text-textSecondary' },
  { value: 'active',    label: 'Active Subscribers',  icon: CheckCircle2,  color: 'text-emerald-600' },
  { value: 'suspended', label: 'Suspended Accounts',  icon: XCircle,       color: 'text-rose-600' },
  { value: 'expiring',  label: 'Expiring in 3 Days',  icon: Clock,         color: 'text-amber-600' },
  { value: 'overdue',   label: 'Overdue Accounts',    icon: AlertTriangle, color: 'text-orange-600' },
];

type Channel = 'sms' | 'whatsapp';
type Tab = 'compose' | 'broadcast' | 'history';

export default function Communication() {
  const [tab, setTab] = useState<Tab>('compose');

  // Compose state
  const [channel, setChannel] = useState<Channel>('sms');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [custSearch, setCustSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [message, setMessage] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Broadcast state
  const [bFilter, setBFilter] = useState('all');
  const [bMessage, setBMessage] = useState('');
  const [bLoading, setBLoading] = useState(false);
  const [bResult, setBResult] = useState<any>(null);
  const [bChannel, setBChannel] = useState<Channel>('sms');

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, sms: 0, whatsapp: 0, failed: 0 });

  useEffect(() => {
    fetchCustomers();
    if (tab === 'history') fetchLogs();
  }, [tab]);

  const fetchCustomers = async () => {
    // Get the current user's profile to retrieve their tenant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) return;

    const { data } = await supabase
      .from('customers')
      .select('id, full_name, phone, account_number, status')
      .eq('tenant_id', profile.tenant_id) // STRICT ISOLATION
      .order('full_name');
    setCustomers(data || []);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await apiFetch(`${API}/logs`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        setStats({
          total:    data.logs.length,
          sms:      data.logs.filter((l: any) => l.channel === 'sms').length,
          whatsapp: data.logs.filter((l: any) => l.channel === 'whatsapp').length,
          failed:   data.logs.filter((l: any) => l.status === 'failed').length,
        });
      }
    } catch (_) {} finally { setLogsLoading(false); }
  };

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => setMessage(tpl.body);

  const smsChars = message.length;
  const smsParts = Math.ceil(smsChars / 160) || 1;

  const custDropdownFiltered = useMemo(() =>
    customers.filter(c => c.full_name.toLowerCase().includes(custSearch.toLowerCase()) || (c.phone || '').includes(custSearch) || (c.account_number || '').includes(custSearch)).slice(0, 8),
    [customers, custSearch]
  );

  const sendMessage = async () => {
    if (!selectedCustomer || !message.trim()) return;
    setSendLoading(true); setSendResult(null);
    try {
      const endpoint = channel === 'sms' ? '/sms/send' : '/whatsapp/send';
      const body = channel === 'sms'
        ? { mobile: selectedCustomer.phone, message, customer_id: selectedCustomer.id }
        : { to: selectedCustomer.phone, message, customer_id: selectedCustomer.id };
      const res = await apiFetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      setSendResult({ ok: data.success, msg: data.success ? 'Message sent successfully.' : (data.error || 'Failed to send.') });
      if (data.success) { setMessage(''); setSelectedCustomer(null); setCustSearch(''); }
    } catch (e: any) {
      setSendResult({ ok: false, msg: 'Network error — ensure backend is running.' });
    } finally { setSendLoading(false); }
  };

  const sendBroadcast = async () => {
    if (!bMessage.trim()) return;
    setBLoading(true); setBResult(null);
    try {
      const res = await apiFetch(`${API}/sms/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter: bFilter, message: bMessage })
      });
      const data = await res.json();
      setBResult(data);
    } catch (e: any) {
      setBResult({ error: 'Network error.' });
    } finally { setBLoading(false); }
  };

  const filteredLogs = useMemo(() =>
    logs.filter(l => !logSearch || l.recipient?.includes(logSearch) || l.message?.toLowerCase().includes(logSearch.toLowerCase()) || l.customers?.full_name?.toLowerCase().includes(logSearch.toLowerCase())),
    [logs, logSearch]
  );

  const ChannelToggle = ({ value, onChange }: { value: Channel; onChange: (c: Channel) => void }) => (
    <div className="flex bg-white/10 rounded-xl p-1 gap-1">
      {(['sms', 'whatsapp'] as Channel[]).map(ch => (
        <button
          key={ch}
          onClick={() => onChange(ch)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-[13px] font-medium transition-all ${value === ch ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
        >
          {ch === 'sms'
            ? <><Smartphone className="w-4 h-4" /> SMS (Celcom)</>
            : <><MessageCircle className="w-4 h-4 text-green-600" /> WhatsApp Business</>
          }
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-medium text-textPrimary">Communication Centre</h2>
        <p className="text-[13px] text-textSecondary mt-1">Send SMS via Celcom or WhatsApp Business messages to your subscribers.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/10 rounded-xl w-fit">
        {([
          { id: 'compose',   label: 'Compose',  icon: MessageSquare },
          { id: 'broadcast', label: 'Broadcast', icon: Zap           },
          { id: 'history',   label: 'History',  icon: Clock         },
        ] as { id: Tab; label: string; icon: any }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-medium transition-all ${tab === t.id ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ======================== COMPOSE ======================== */}
      {tab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left — Templates */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-[13px] font-medium text-textPrimary">Quick Templates</h3>
            <div className="space-y-2">
              {TEMPLATES.map(t => (
                <button
                  key={t.label}
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left p-3.5 bg-bgSecondary border border-white/10 rounded-xl hover:border-emerald-500/40 hover:bg-emerald-50/30 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[12px] font-medium text-textPrimary group-hover:text-emerald-700">{t.label}</span>
                  </div>
                  <p className="text-[11px] text-textSecondary leading-relaxed truncate">{t.body.slice(0, 60)}...</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right — Compose Panel */}
          <div className="lg:col-span-3 card space-y-5">
            <ChannelToggle value={channel} onChange={setChannel} />

            {/* Customer selector */}
            <div className="relative">
              <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Send To</label>
              <div
                className="input-field cursor-pointer flex items-center justify-between"
                onClick={() => setShowCustDropdown(!showCustDropdown)}
              >
                {selectedCustomer
                  ? <span className="font-medium text-textPrimary">{selectedCustomer.full_name} — {selectedCustomer.phone}</span>
                  : <span className="text-textSecondary">Search customer...</span>}
                <ChevronDown className="w-4 h-4 text-textSecondary shrink-0" />
              </div>
              {showCustDropdown && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-bgSecondary border border-white/10 rounded-xl shadow-lg z-20 overflow-hidden">
                  <div className="p-2 border-b border-white/5">
                    <input
                      autoFocus
                      type="text"
                      value={custSearch}
                      onChange={e => setCustSearch(e.target.value)}
                      placeholder="Search by name, phone..."
                      className="w-full px-3 py-2 text-[13px] bg-white/5 rounded-lg border border-white/10 outline-none"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {custDropdownFiltered.length === 0
                      ? <p className="text-[12px] text-textSecondary p-4 text-center">No customers found</p>
                      : custDropdownFiltered.map(c => (
                          <button
                            key={c.id}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition flex items-center justify-between"
                            onClick={() => { setSelectedCustomer(c); setShowCustDropdown(false); setCustSearch(''); }}
                          >
                            <div>
                              <p className="text-[13px] font-medium text-textPrimary">{c.full_name}</p>
                              <p className="text-[11px] text-textSecondary font-mono">{c.phone}</p>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{c.status}</span>
                          </button>
                        ))
                    }
                  </div>
                </div>
              )}
              {selectedCustomer && (
                <button onClick={() => setSelectedCustomer(null)} className="absolute right-10 top-9 text-textSecondary hover:text-textSecondary">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                className="input-field resize-none"
                placeholder="Type your message here, or click a template on the left..."
              />
              {channel === 'sms' && (
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[11px] text-textSecondary">Variables: {'{name}'} {'{account}'} {'{due_date}'}</p>
                  <p className={`text-[11px] font-medium ${smsChars > 160 ? 'text-amber-600' : 'text-textSecondary'}`}>
                    {smsChars} chars · {smsParts} SMS part{smsParts > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {sendResult && (
              <div className={`p-3.5 rounded-xl text-[13px] flex items-center gap-2 ${sendResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {sendResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                {sendResult.msg}
              </div>
            )}

            <button
              onClick={sendMessage}
              disabled={sendLoading || !selectedCustomer || !message.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {sendLoading
                ? <><CustomLoader inline size="sm" /> Sending...</>
                : <><Send className="w-4 h-4" /> Send {channel === 'sms' ? 'SMS' : 'WhatsApp'}</>}
            </button>
          </div>
        </div>
      )}

      {/* ======================== BROADCAST ======================== */}
      {tab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audience Selector */}
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-[13px] font-medium text-textPrimary">Target Audience</h3>
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setBFilter(f.value)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${bFilter === f.value ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500/20' : 'border-white/10 bg-bgSecondary hover:border-white/20'}`}
              >
                <f.icon className={`w-4 h-4 shrink-0 ${bFilter === f.value ? 'text-emerald-500' : f.color}`} />
                <span className={`text-[13px] font-medium ${bFilter === f.value ? 'text-emerald-700' : 'text-textPrimary'}`}>{f.label}</span>
              </button>
            ))}
          </div>

          {/* Message composer */}
          <div className="lg:col-span-2 card space-y-5">
            <ChannelToggle value={bChannel} onChange={setBChannel} />

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Broadcast sends to all customers in your selected group.</strong> Messages are personalized automatically using {'{name}'}, {'{account}'}, and {'{due_date}'} variables.
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Broadcast Message</label>
              <textarea
                value={bMessage}
                onChange={e => setBMessage(e.target.value)}
                rows={6}
                className="input-field resize-none"
                placeholder="Dear {name}, your account {account} expires on {due_date}..."
              />
              <p className="text-[11px] text-textSecondary mt-1.5">Variables: {'{name}'} {'{full_name}'} {'{account}'} {'{due_date}'}</p>
            </div>

            {/* Quick template buttons */}
            <div>
              <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Quick Insert Template</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => setBMessage(t.body)} className="text-[11px] font-medium bg-white/10 text-textSecondary hover:bg-white/10 px-3 py-1.5 rounded-lg transition">
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {bResult && (
              <div className={`p-4 rounded-xl border text-[13px] ${bResult.error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                {bResult.error
                  ? bResult.error
                  : <>✅ Sent to <strong>{bResult.results?.sent}</strong> · Failed: <strong>{bResult.results?.failed}</strong> · Skipped (no phone): <strong>{bResult.results?.skipped}</strong> of {bResult.results?.total} total</>}
              </div>
            )}

            <button
              onClick={sendBroadcast}
              disabled={bLoading || !bMessage.trim()}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {bLoading
                ? <><CustomLoader inline size="sm" /> Sending to group...</>
                : <><Zap className="w-4 h-4" /> Broadcast to {FILTERS.find(f => f.value === bFilter)?.label}</>}
            </button>
          </div>
        </div>
      )}

      {/* ======================== HISTORY ======================== */}
      {tab === 'history' && (
        <div className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sent', value: stats.total, color: 'text-textPrimary' },
              { label: 'SMS',        value: stats.sms,   color: 'text-blue-600'  },
              { label: 'WhatsApp',   value: stats.whatsapp, color: 'text-green-600' },
              { label: 'Failed',     value: stats.failed, color: 'text-rose-600'  },
            ].map(s => (
              <div key={s.label} className="card py-4 text-center">
                <p className={`text-[24px] font-medium ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-textSecondary mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search + Refresh */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
              <input type="text" value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder="Search logs..." className="pl-10 input-field" />
            </div>
            <button onClick={fetchLogs} className="btn-secondary flex items-center gap-2 text-[13px]">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            {logsLoading ? (
              <div className="flex items-center justify-center h-32"><CustomLoader inline size="sm" /></div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <BarChart3 className="w-6 h-6 text-textSecondary mb-2" />
                <p className="text-[13px] text-textSecondary">No message history yet.</p>
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                    <th className="px-5 py-3.5">Channel</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Recipient</th>
                    <th className="px-5 py-3.5">Message</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-white/5">
                      <td className="px-5 py-3.5">
                        {log.channel === 'sms'
                          ? <span className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600"><Smartphone className="w-3.5 h-3.5" /> SMS</span>
                          : <span className="flex items-center gap-1.5 text-[12px] font-medium text-green-600"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</span>}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-medium text-textPrimary">{log.customers?.full_name || '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-[12px] text-textSecondary">{log.recipient}</td>
                      <td className="px-5 py-3.5 max-w-[240px]">
                        <p className="text-[12px] text-textSecondary truncate">{log.message}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${log.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-textSecondary">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
