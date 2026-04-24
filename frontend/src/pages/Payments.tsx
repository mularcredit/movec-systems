import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, CreditCard, Download, X, Loader2, CheckCircle2, Smartphone, History, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/apiClient';
import { SelectDropdown } from '../components/ui/SelectDropdown';
import { Combobox } from '../components/ui/Combobox';

// Use relative paths for production compatibility
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
  const [modal, setModal] = useState<PayModal>({
    open: false, loading: false, error: '', success: false, mode: 'stk',
    customerId: '', amount: '', method: 'M-Pesa', txnCode: '', notes: '', phone: ''
  });

  const fetchPayments = async () => {
    setLoading(true);
    
    // Get the current user's profile to retrieve their tenant_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
       console.error("Tenant configuration missing.");
       setLoading(false);
       return;
    }

    const tenantId = profile.tenant_id;

    const { data } = await supabase
      .from('payments')
      .select('id, transaction_code, amount, carry_forward_applied, method, status, paid_at, notes, customers(full_name, account_number), services(account_number, persons(full_name, phone))')
      .eq('tenant_id', tenantId) // STRICT ISOLATION
      .order('paid_at', { ascending: false });
    if (data) {
      setPayments(data.map(p => {
        // Resolve customer name across both models
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
          status: p.status,
          notes: p.notes
        };
      }));
    }
    setLoading(false);
  };

  const fetchCustomers = async () => {
    // We need the tenant_id from the user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) return;
    const tenantId = profile.tenant_id;

    // Fetch from both legacy and new model — BOTH WITH STRICT ISOLATION
    const [legacy, modern] = await Promise.all([
        supabase.from('customers').select('id, full_name, account_number, phone').eq('tenant_id', tenantId).eq('status', 'active'),
        supabase.from('services').select('id, account_number, status, persons(full_name, phone)').eq('tenant_id', tenantId).eq('status', 'active')
    ]);

    const combined = [
        ...(legacy.data || []).map(c => ({ id: c.id, full_name: c.full_name, account_number: c.account_number, phone: c.phone, isLegacy: true })),
        ...(modern.data || []).map(s => ({ 
            id: s.id, 
            full_name: (s.persons as any)?.full_name || 'Unknown', 
            account_number: s.account_number, 
            phone: (s.persons as any)?.phone || '—',
            isLegacy: false 
        }))
    ];

    setCustomers(combined.sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  useEffect(() => { fetchPayments(); fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    return payments.filter(p => {
      const matchMethod = methodFilter === 'All Methods' || p.method === methodFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || p.txn.toLowerCase().includes(q) || p.customer.toLowerCase().includes(q) || p.account.toLowerCase().includes(q);
      return matchMethod && matchSearch;
    });
  }, [payments, search, methodFilter]);

  const totalFiltered = filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  const setM = (k: keyof PayModal, v: any) => setModal(prev => ({ ...prev, [k]: v }));

  const openModal = () => setModal(prev => ({
    ...prev, open: true, error: '', success: false, mode: 'stk',
    customerId: '', amount: '', method: 'M-Pesa', txnCode: '', notes: '', phone: ''
  }));

  // Auto-fill phone when customer selected
  useEffect(() => {
    if (modal.customerId) {
        const c = customers.find(c => c.id === modal.customerId);
        if (c?.phone) setM('phone', c.phone);
    }
  }, [modal.customerId]);

  const handleSubmit = async () => {
    if (!modal.customerId || !modal.amount || isNaN(parseFloat(modal.amount))) {
      setM('error', 'Customer and a valid amount are required.'); return;
    }
    
    setM('loading', true); setM('error', '');
    
    try {
      const endpoint = modal.mode === 'stk' ? `${API_BASE}/mpesa/stk-push` : `${API_BASE}/mpesa/manual`;
      const body = modal.mode === 'stk' 
        ? { customer_id: modal.customerId, amount: parseFloat(modal.amount), phone: modal.phone }
        : {
            customer_id: modal.customerId,
            amount: parseFloat(modal.amount),
            method: modal.method,
            transaction_code: modal.txnCode || null,
            notes: modal.notes || null
          };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      
      setM('success', true);
      if (modal.mode === 'manual') fetchPayments();
      
      setTimeout(() => setModal(prev => ({ ...prev, open: false })), 2000);
    } catch (e: any) {
      setM('error', e.message);
    } finally {
      setM('loading', false);
    }
  };

  const downloadReceipt = async (id: string) => {
    // PDF Receipt implementation coming in Phase 2
    window.open(`${API_BASE}/payments/${id}/receipt`, '_blank');
  };

  const methodBadgeClass: Record<string, string> = {
    'M-Pesa':        'bg-green-50 text-green-700 border border-green-200',
    'Cash':          'bg-amber-50 text-amber-700 border border-amber-200',
    'Bank Transfer': 'bg-blue-50 text-blue-700 border border-blue-200',
  };

  return (
    <div className="space-y-6">
      {/* Payment Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-[17px] font-medium text-slate-800">
                    {modal.mode === 'stk' ? 'Request Mobile Payment' : 'Record Manual Payment'}
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                    {modal.mode === 'stk' ? 'Initiate an STK Push to the customer\'s phone.' : 'Log a cash or external bank payment.'}
                </p>
              </div>
              <button onClick={() => setM('open', false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {modal.success ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="w-14 h-14 text-emerald-500 mb-3" />
                <p className="text-[16px] font-medium text-slate-800">
                    {modal.mode === 'stk' ? 'STK Push Sent' : 'Payment Recorded'}
                </p>
                <p className="text-[13px] text-slate-500 mt-1">
                    {modal.mode === 'stk' ? 'Ask the customer to enter their PIN.' : 'The financial ledger has been updated.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mode Selector */}
                <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                    <button 
                        onClick={() => setM('mode', 'stk')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${modal.mode === 'stk' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Smartphone className="w-3.5 h-3.5" /> STK Push
                    </button>
                    <button 
                        onClick={() => setM('mode', 'manual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-[12px] font-medium transition-all ${modal.mode === 'manual' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <History className="w-3.5 h-3.5" /> Manual Entry
                    </button>
                </div>

                {/* Customer */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Customer *</label>
                  <Combobox
                    value={modal.customerId}
                    onChange={(val: string) => setM('customerId', val)}
                    options={customers.map(c => ({ label: `${c.full_name} (${c.account_number})`, value: c.id }))}
                    placeholder="Search active customer..."
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Amount (KES) *</label>
                  <input type="number" value={modal.amount} onChange={e => setM('amount', e.target.value)} className="input-field font-mono" placeholder="2500" />
                </div>

                {modal.mode === 'stk' ? (
                    <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">M-Pesa Phone Number</label>
                        <input type="text" value={modal.phone} onChange={e => setM('phone', e.target.value)} className="input-field font-mono" placeholder="254712345678" />
                    </div>
                ) : (
                    <>
                        <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Payment Method</label>
                        <SelectDropdown
                          value={modal.method}
                          onChange={(val: string) => setM('method', val)}
                          options={['M-Pesa', 'Cash', 'Bank Transfer', 'Cheque']}
                        />
                        </div>
                        <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Transaction Code (Optional)</label>
                        <input type="text" value={modal.txnCode} onChange={e => setM('txnCode', e.target.value)} className="input-field font-mono" placeholder="e.g. SIC7XXXXXXX" />
                        </div>
                    </>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Notes</label>
                  <input type="text" value={modal.notes} onChange={e => setM('notes', e.target.value)} className="input-field" placeholder="e.g. Subscription extension" />
                </div>

                {modal.error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[12px] text-rose-700">{modal.error}</div>}

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setM('open', false)} className="flex-1 btn-secondary text-[13px]">Cancel</button>
                  <button onClick={handleSubmit} disabled={modal.loading} className={`flex-1 btn-primary text-[13px] flex items-center justify-center gap-2 ${modal.mode === 'stk' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}>
                    {modal.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : modal.mode === 'stk' ? 'Send STK Push' : 'Record Payment'}
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
          <h2 className="text-[18px] font-medium text-slate-800">Financial Ledger</h2>
          <p className="text-[13px] text-slate-500 mt-1">M-Pesa IPN receipts, STK Push requests, and manual logs</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-secondary flex items-center text-[13px]">
            <Download className="w-4 h-4 mr-2" /> Export
          </button>
          <button onClick={openModal} className="btn-primary flex items-center text-[13px]">
            <Plus className="w-4 h-4 mr-2" /> New Payment Request
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 text-[13px] text-slate-500 bg-slate-50/50 border border-slate-200/60 rounded-xl px-4 py-3">
          <span className="font-medium text-slate-800">{filtered.length} transactions</span> showing ·
          <span className="font-medium text-emerald-700">Ksh {totalFiltered.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span> total
        </div>
      )}

      <div className="card p-0 flex flex-col">
        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-t-xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by TXN code, customer, or account..." className="pl-10 input-field" />
          </div>
          <SelectDropdown
            value={methodFilter}
            onChange={setMethodFilter}
            options={['All Methods', 'M-Pesa', 'Cash', 'Bank Transfer', 'Cheque']}
            className="max-w-[180px]"
          />
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-3" />
            <p className="text-[13px] text-slate-500">Loading payment ledger...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <CreditCard className="w-8 h-8 text-slate-300 mb-4" />
            <h3 className="text-[15px] font-medium text-slate-800 mb-1">No Transactions Found</h3>
            <p className="text-[13px] text-slate-500 max-w-sm">
              {search ? `Nothing matching "${search}".` : 'No payments recorded yet.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#fbfbfd] text-slate-500 text-[11px] font-medium uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-5 py-3.5">TXN Code</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5">Channel</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(pay => (
                <tr key={pay.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-[12px] text-slate-700">
                    <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{pay.txn}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[13px] text-slate-800">{pay.customer}</p>
                    <p className="font-mono text-[11px] text-slate-400 mt-0.5">{pay.account}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-[14px]">
                    <div className="text-emerald-700">Ksh {parseFloat(pay.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
                    {pay.credit > 0 && (
                        <div className="text-[10px] text-blue-600 font-bold bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 mt-1 inline-block">
                            Carry Fwd: Ksh {parseFloat(pay.credit).toLocaleString()}
                        </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${methodBadgeClass[pay.method] || 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {pay.method}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[12px] text-slate-500">{pay.date}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button 
                        onClick={() => downloadReceipt(pay.id)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Download Receipt"
                    >
                        <Receipt className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
