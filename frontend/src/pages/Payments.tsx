import React, { useState, useEffect, useMemo } from 'react';
import { IconCircleCheck, IconCreditCard, IconDeviceMobile, IconDownload, IconHistory, IconLoader2, IconPlus, IconReceipt, IconSearch, IconX, IconCalendar, IconAlertTriangle } from '@tabler/icons-react';
import CustomLoader from '../components/common/CustomLoader';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/apiClient';
import { SelectDropdown } from '../components/ui/SelectDropdown';
import { Combobox } from '../components/ui/Combobox';

const API_BASE = '/api';

interface PayModal {
  open: boolean; loading: boolean; error: string; success: boolean; mode: 'manual' | 'stk';
  customerId: string; amount: string; method: string; txnCode: string; notes: string; phone: string;
}

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All Methods');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modal, setModal] = useState<PayModal>({
    open: false, loading: false, error: '', success: false, mode: 'stk',
    customerId: '', amount: '', method: 'M-Pesa', txnCode: '', notes: '', phone: ''
  });

  const fetchPayments = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) { setLoading(false); return; }

    const { data } = await supabase
      .from('payments')
      .select('id, transaction_code, amount, carry_forward_applied, method, status, paid_at, notes, customers(full_name, account_number), services(account_number, persons(full_name, phone))')
      .eq('tenant_id', profile.tenant_id)
      .order('paid_at', { ascending: false });

    if (data) {
      setPayments(data.map(p => {
        const customerName = (p.customers as any)?.full_name || (p.services as any)?.persons?.full_name || 'Unmatched';
        const accountNum = (p.customers as any)?.account_number || (p.services as any)?.account_number || '—';
        return {
          id: p.id,
          txn: p.transaction_code || 'MANUAL',
          customer: customerName,
          account: accountNum,
          amount: p.amount,
          credit: p.carry_forward_applied || 0,
          method: p.method,
          date: p.paid_at ? new Date(p.paid_at).toLocaleString() : '—',
          dateRaw: p.paid_at,
          status: p.status || 'completed',
          notes: p.notes
        };
      }));
    }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) return;

    const [legacy, modern] = await Promise.all([
      supabase.from('customers').select('id, full_name, account_number, phone').eq('tenant_id', profile.tenant_id).eq('status', 'active'),
      supabase.from('services').select('id, account_number, status, persons(full_name, phone)').eq('tenant_id', profile.tenant_id).eq('status', 'active')
    ]);

    const combined = [
      ...(legacy.data || []).map(c => ({ id: c.id, full_name: c.full_name, account_number: c.account_number, phone: c.phone })),
      ...(modern.data || []).map(s => ({
        id: s.id,
        full_name: (s.persons as any)?.full_name || 'Unknown',
        account_number: s.account_number,
        phone: (s.persons as any)?.phone || '—'
      }))
    ];
    setCustomers(combined.sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  useEffect(() => { fetchPayments(); fetchCustomers(); }, []);

  useEffect(() => {
    if (modal.customerId) {
      const c = customers.find(c => c.id === modal.customerId);
      if (c?.phone) setM('phone', c.phone);
    }
  }, [modal.customerId]);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const matchMethod = methodFilter === 'All Methods' || p.method === methodFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || p.txn.toLowerCase().includes(q) || p.customer.toLowerCase().includes(q) || p.account.toLowerCase().includes(q);
      const matchFrom = !dateFrom || (p.dateRaw && p.dateRaw >= dateFrom);
      const matchTo = !dateTo || (p.dateRaw && p.dateRaw <= dateTo + 'T23:59:59');
      return matchMethod && matchSearch && matchFrom && matchTo;
    });
  }, [payments, search, methodFilter, dateFrom, dateTo]);

  const totalFiltered = filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  const setM = (k: keyof PayModal, v: any) => setModal(prev => ({ ...prev, [k]: v }));

  const openModal = () => setModal(prev => ({
    ...prev, open: true, error: '', success: false, mode: 'stk',
    customerId: '', amount: '', method: 'M-Pesa', txnCode: '', notes: '', phone: ''
  }));

  const handleSubmit = async () => {
    if (!modal.customerId || !modal.amount || isNaN(parseFloat(modal.amount))) {
      setM('error', 'Customer and a valid amount are required.'); return;
    }
    setM('loading', true); setM('error', '');
    try {
      const endpoint = modal.mode === 'stk' ? `${API_BASE}/mpesa/stk-push` : `${API_BASE}/mpesa/manual`;
      const body = modal.mode === 'stk'
        ? { customer_id: modal.customerId, amount: parseFloat(modal.amount), phone: modal.phone }
        : { customer_id: modal.customerId, amount: parseFloat(modal.amount), method: modal.method, transaction_code: modal.txnCode || null, notes: modal.notes || null };

      const res = await apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setM('success', true);
      // Always refresh after payment (STK pending will show up as pending)
      await fetchPayments();
      setTimeout(() => setModal(prev => ({ ...prev, open: false })), 2000);
    } catch (e: any) {
      setM('error', e.message);
    } finally {
      setM('loading', false);
    }
  };

  const downloadReceipt = (id: string) => {
    window.open(`${API_BASE}/payments/${id}/receipt`, '_blank');
  };

  const exportCSV = () => {
    const headers = ['TXN Code', 'Customer', 'Account', 'Amount (KES)', 'Channel', 'Status', 'Date', 'Notes'];
    const rows = filtered.map(p => [
      p.txn, p.customer, p.account,
      parseFloat(p.amount).toFixed(2),
      p.method, p.status, p.date, p.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge: Record<string, string> = {
    completed:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    pending:    'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    failed:     'bg-rose-500/15 text-rose-400 border border-rose-500/20',
    cancelled:  'bg-white/10 text-textSecondary border border-white/10',
  };

  const methodBadge: Record<string, string> = {
    'M-Pesa':        'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
    'Cash':          'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    'Bank Transfer': 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
    'Cheque':        'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20',
  };

  return (
    <div className="space-y-6">
      {/* Payment Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[17px] font-medium text-textPrimary">
                  {modal.mode === 'stk' ? 'Request Mobile Payment' : 'Record Manual Payment'}
                </h3>
                <p className="text-[12px] text-textSecondary mt-0.5">
                  {modal.mode === 'stk' ? "Initiate an STK Push to the customer's phone." : 'Log a cash or external bank payment.'}
                </p>
              </div>
              <button onClick={() => setM('open', false)} className="text-textSecondary hover:text-textPrimary"><IconX className="w-5 h-5" /></button>
            </div>

            {modal.success ? (
              <div className="flex flex-col items-center py-8 text-center">
                <IconCircleCheck className="w-14 h-14 text-emerald-500 mb-3" />
                <p className="text-[16px] font-medium text-textPrimary">
                  {modal.mode === 'stk' ? 'STK Push Sent' : 'Payment Recorded'}
                </p>
                <p className="text-[13px] text-textSecondary mt-1">
                  {modal.mode === 'stk' ? 'Ask the customer to enter their PIN.' : 'The financial ledger has been updated.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode Selector */}
                <div className="flex p-1 bg-white/10 rounded-lg mb-4">
                  <button
                    onClick={() => setM('mode', 'stk')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${modal.mode === 'stk' ? 'bg-bgSecondary text-emerald-400 shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
                  >
                    <IconDeviceMobile className="w-3.5 h-3.5" /> STK Push
                  </button>
                  <button
                    onClick={() => setM('mode', 'manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${modal.mode === 'manual' ? 'bg-bgSecondary text-textPrimary shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
                  >
                    <IconHistory className="w-3.5 h-3.5" /> Manual Entry
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Customer *</label>
                  <Combobox
                    value={modal.customerId}
                    onChange={(val: string) => setM('customerId', val)}
                    options={customers.map(c => ({ label: `${c.full_name} (${c.account_number})`, value: c.id }))}
                    placeholder="Search active customer..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Amount (KES) *</label>
                  <input type="number" value={modal.amount} onChange={e => setM('amount', e.target.value)} className="input-field font-mono" placeholder="2500" />
                </div>

                {modal.mode === 'stk' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">M-Pesa Phone Number</label>
                    <input type="text" value={modal.phone} onChange={e => setM('phone', e.target.value)} className="input-field font-mono" placeholder="254712345678" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Payment Method</label>
                      <SelectDropdown value={modal.method} onChange={(val: string) => setM('method', val)} options={['M-Pesa', 'Cash', 'Bank Transfer', 'Cheque']} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Transaction Code (Optional)</label>
                      <input type="text" value={modal.txnCode} onChange={e => setM('txnCode', e.target.value)} className="input-field font-mono" placeholder="e.g. SIC7XXXXXXX" />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Notes</label>
                  <input type="text" value={modal.notes} onChange={e => setM('notes', e.target.value)} className="input-field" placeholder="e.g. Subscription extension" />
                </div>

                {modal.error && <div className="p-3 bg-rose-500/15 border border-rose-500/20 rounded-xl text-[12px] text-rose-400">{modal.error}</div>}

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setM('open', false)} className="flex-1 btn-secondary text-[13px]">Cancel</button>
                  <button
                    onClick={handleSubmit}
                    disabled={modal.loading}
                    className={`flex-1 btn-primary text-[13px] flex items-center justify-center gap-2 ${modal.mode === 'stk' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                  >
                    {modal.loading ? <><CustomLoader inline size="sm" /> Processing...</> : modal.mode === 'stk' ? 'Send STK Push' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-textPrimary">Financial Ledger</h2>
          <p className="text-[13px] text-textSecondary mt-1">M-Pesa IPN receipts, STK Push requests, and manual logs</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="btn-secondary flex items-center text-[13px]">
            <IconDownload className="w-4 h-4 mr-2" /> Export CSV
          </button>
          <button onClick={openModal} className="btn-primary flex items-center text-[13px]">
            <IconPlus className="w-4 h-4 mr-2" /> New Payment
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 text-[13px] text-textSecondary bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <span className="font-medium text-textPrimary">{filtered.length} transactions</span> showing ·
          <span className="font-medium text-emerald-400">Ksh {totalFiltered.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span> total
        </div>
      )}

      <div className="card p-0 flex flex-col">
        {/* Search, Filter & Date Range */}
        <div className="p-4 border-b border-white/10 flex flex-col gap-3 bg-bgSecondary rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search TXN code, customer, or account..." className="pl-10 input-field" />
            </div>
            <SelectDropdown value={methodFilter} onChange={setMethodFilter} options={['All Methods', 'M-Pesa', 'Cash', 'Bank Transfer', 'Cheque']} className="max-w-[180px]" />
          </div>
          {/* Date range row */}
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <div className="flex items-center gap-2 text-textSecondary">
              <IconCalendar className="w-4 h-4" />
              <span>Date range:</span>
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field text-[12px] py-1.5 max-w-[160px]" />
            <span className="text-textSecondary">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field text-[12px] py-1.5 max-w-[160px]" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-textSecondary hover:text-textPrimary text-[11px] underline">
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <CustomLoader />
            <p className="text-[13px] text-textSecondary">Loading payment ledger...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <IconCreditCard className="w-8 h-8 text-textSecondary mb-4" />
            <h3 className="text-[15px] font-medium text-textPrimary mb-1">No Transactions Found</h3>
            <p className="text-[13px] text-textSecondary max-w-sm">
              {search ? `Nothing matching "${search}".` : 'No payments recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                  <th className="px-5 py-3.5">TXN Code</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Channel</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(pay => (
                  <tr key={pay.id} className={`hover:bg-white/5 transition-colors ${pay.customer === 'Unmatched' ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-textPrimary">
                      <span className="bg-white/10 border border-white/10 px-2 py-0.5 rounded">{pay.txn}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {pay.customer === 'Unmatched' && (
                          <IconAlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Unmatched payment — no customer linked" />
                        )}
                        <div>
                          <p className="font-medium text-[13px] text-textPrimary">{pay.customer}</p>
                          <p className="font-mono text-[11px] text-textSecondary mt-0.5">{pay.account}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium text-[14px]">
                      <div className="text-emerald-400">Ksh {parseFloat(pay.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
                      {pay.credit > 0 && (
                        <div className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5 mt-1 inline-block">
                          Carry Fwd: Ksh {parseFloat(pay.credit).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${methodBadge[pay.method] || 'bg-white/10 text-textSecondary border border-white/10'}`}>
                        {pay.method}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${statusBadge[pay.status] || statusBadge['completed']}`}>
                        {(pay.status || 'completed').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-textSecondary">{pay.date}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => downloadReceipt(pay.id)}
                        className="p-2 text-textSecondary hover:text-emerald-400 transition-colors"
                        title="Download PDF Receipt"
                      >
                        <IconReceipt className="w-4 h-4" />
                      </button>
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
