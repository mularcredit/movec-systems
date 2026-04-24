import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, MoreVertical, ShieldAlert, UserX, UserCheck, Loader2, X, Eye, Trash2, AlertTriangle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiClient';
import { SelectDropdown } from '../../components/ui/SelectDropdown';

const API = '/api/router';

interface Customer {
  id: string; person_id?: string; account_id: string; name: string; phone: string;
  status: string; balance: number; package: string; due_date: string;
  router_id: string | null; username: string | null;
}

interface SuspendModal {
  open: boolean; customer: Customer | null; reason: string; loading: boolean;
}

export default function AllUsers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [modal, setModal] = useState<SuspendModal>({ open: false, customer: null, reason: '', loading: false });
  const [deleteModal, setDeleteModal] = useState<{ customer: Customer | null, loading: boolean }>({ customer: null, loading: false });
  const [toast, setToast] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const fetchCustomers = async () => {
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
      console.error("Tenant configuration missing for current user.");
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('persons')
      .select(`
        id, full_name, phone, email,
        services (
          id, account_number, status, balance, next_due_date,
          router_id, username,
          packages ( display_name )
        )
      `)
      .eq('tenant_id', profile.tenant_id) // STRICT ISOLATION
      .order('full_name', { ascending: true });

    if (data) {
      const flattened: Customer[] = [];
      data.forEach(p => {
        const pServices = p.services as any[];
        if (!pServices || pServices.length === 0) {
          // Orphaned person (no service)
          flattened.push({
            id: 'unassigned-' + p.id,
            person_id: p.id,
            account_id: 'PENDING',
            name: p.full_name,
            phone: p.phone || '—',
            status: 'incomplete',
            balance: 0,
            due_date: 'N/A',
            package: 'No Plan Linked',
            router_id: null,
            username: null
          });
        } else {
          pServices.forEach(s => {
            flattened.push({
              id: s.id,
              person_id: p.id,
              account_id: s.account_number,
              name: p.full_name,
              phone: p.phone || '—',
              status: s.status,
              balance: s.balance,
              due_date: s.next_due_date || 'N/A',
              package: s.packages?.display_name || 'Unassigned',
              router_id: s.router_id,
              username: s.username
            });
          });
        }
      });
      setCustomers(flattened);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    return customers.filter(u => {
      const matchStatus = statusFilter === 'All Statuses' || u.status === statusFilter.toLowerCase();
      const q = search.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.account_id.toLowerCase().includes(q) || (u.phone && u.phone.includes(q));
      return matchStatus && matchSearch;
    });
  }, [customers, search, statusFilter]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const openSuspend = (c: Customer) => setModal({ open: true, customer: c, reason: '', loading: false });
  const closeModal  = () => setModal({ open: false, customer: null, reason: '', loading: false });

  const confirmAction = async () => {
    const c = modal.customer!;
    const isSuspending = c.status === 'active';
    setModal(prev => ({ ...prev, loading: true }));

    // 1. Update DB status in services table
    const newStatus = isSuspending ? 'suspended' : 'active';
    await supabase.from('services').update({ status: newStatus }).eq('id', c.id);

    // 2. If router + username configured, push to MikroTik
    if (c.router_id && c.username) {
      const action = isSuspending ? 'suspend' : 'reconnect';
      try {
        const res = await apiFetch(`${API}/${c.router_id}/pppoe/${action}/${encodeURIComponent(c.username)}`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) console.warn('MikroTik action warning:', data.error);
      } catch (e) {
        console.warn('MikroTik unreachable — DB updated but router not changed.');
      }
    }

    // 3. Log suspension reason
    if (isSuspending && modal.reason) {
      await supabase.from('suspensions').insert([{ customer_id: c.id, reason: modal.reason }]);
    }

    showToast(isSuspending ? `${c.name} suspended.` : `${c.name} reconnected.`);
    closeModal();
    fetchCustomers();
  };

  const confirmDelete = async () => {
    const c = deleteModal.customer;
    if (!c) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    
    // 1. Delete associated services if any
    if (!c.id.startsWith('unassigned-')) {
       await supabase.from('services').delete().eq('id', c.id);
    }
    
    // 2. Delete the underlying identity (person record)
    if (c.person_id) {
       await supabase.from('persons').delete().eq('id', c.person_id);
    }
    
    showToast(`${c.name} totally eradicated from system.`);
    setDeleteModal({ customer: null, loading: false });
    fetchCustomers();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
      suspended: 'bg-rose-50 text-rose-700 border border-rose-200',
      expired:   'bg-amber-50 text-amber-700 border border-amber-200',
      pending:   'bg-slate-100 text-slate-600 border border-slate-200',
      incomplete: 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6" onClick={() => setMenuOpenId(null)}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-slate-800 text-white text-[13px] font-medium px-4 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Suspend / Reconnect Confirmation Modal */}
      {modal.open && modal.customer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${modal.customer.status === 'active' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                  {modal.customer.status === 'active' ? <UserX className="w-5 h-5 text-rose-600" /> : <UserCheck className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-slate-800">
                    {modal.customer.status === 'active' ? 'Suspend Account' : 'Reconnect Account'}
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">{modal.customer.name}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {modal.customer.status === 'active' ? (
              <>
                <p className="text-[13px] text-slate-600 mb-4">
                  This will disable the customer's PPP secret on MikroTik and terminate any live session.
                  {!modal.customer.router_id && <span className="text-amber-600"> No router linked — DB only.</span>}
                </p>
                <label className="block text-[11px] font-medium text-slate-500 mb-2 uppercase tracking-wide">Reason</label>
                <input
                  type="text" value={modal.reason}
                  onChange={e => setModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="input-field mb-5" placeholder="e.g. Non-payment — invoice overdue 7 days"
                />
              </>
            ) : (
              <p className="text-[13px] text-slate-600 mb-6">
                This will re-enable the customer's PPP secret. They will be able to authenticate immediately.
                {!modal.customer.router_id && <span className="text-amber-600"> No router linked — DB only.</span>}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 btn-secondary text-[13px]">Cancel</button>
              <button
                onClick={confirmAction}
                disabled={modal.loading}
                className={`flex-1 text-[13px] py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                  modal.customer.status === 'active' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                {modal.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (modal.customer.status === 'active' ? 'Suspend' : 'Reconnect')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.customer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-slate-800">Delete Customer</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">{deleteModal.customer.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteModal({ customer: null, loading: false })} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-slate-600 mb-6">
              Are you sure you want to permanently remove <span className="font-semibold text-slate-800">{deleteModal.customer.name}</span> from the system?<br/><br/>
              This action <span className="font-semibold text-rose-600">cannot be undone</span> and will delete all associated data.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteModal({ customer: null, loading: false })} 
                className="flex-1 btn-secondary text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteModal.loading}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-[13px] py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {deleteModal.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-slate-800">All Customers</h2>
          <p className="text-[13px] text-slate-500 mt-1">{customers.length} total subscriber{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/customers/add')} className="btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Onboard Customer
        </button>
      </div>

      <div className="card p-0 flex flex-col">
        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-200/60 flex flex-col sm:flex-row sm:items-center gap-3 bg-white rounded-t-xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, account ID, or phone..." className="pl-10 input-field" />
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={['All Statuses', 'Active', 'Suspended', 'Pending', 'Expired']}
            className="max-w-[180px]"
          />
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mb-3" />
            <p className="text-[13px] text-slate-500">Loading subscriber database...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <ShieldAlert className="w-8 h-8 text-slate-300 mb-4" />
            <h3 className="text-[15px] font-medium text-slate-800 mb-1">{search || statusFilter !== 'All Statuses' ? 'No matches found' : 'No Customers Registered'}</h3>
            <p className="text-[13px] text-slate-500 max-w-sm mb-6">
              {search ? `No customers match "${search}".` : 'Onboard your first subscriber to get started.'}
            </p>
            {!search && statusFilter === 'All Statuses' && (
              <button onClick={() => navigate('/customers/add')} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Onboard Customer</button>
            )}
          </div>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-[#fbfbfd] text-slate-500 text-[11px] font-medium uppercase tracking-wider border-b border-slate-200/60">
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Package</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Balance</th>
                <th className="px-5 py-3.5">Next Bill</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[13px] text-slate-800">{u.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{u.account_id}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-slate-600">{u.phone}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{u.package}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize ${statusBadge(u.status)}`}>{u.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-[13px]">
                    {parseFloat(String(u.balance)) > 0
                      ? <span className="text-rose-600">Ksh {u.balance}</span>
                      : parseFloat(String(u.balance)) < 0
                        ? <span className="text-emerald-600">Ksh {Math.abs(parseFloat(String(u.balance))).toFixed(2)} CR</span>
                        : <span className="text-slate-600">Ksh 0</span>}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-slate-600 font-medium">{u.due_date}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openSuspend(u)}
                        className={`text-[12px] font-medium px-3 py-1.5 rounded transition ${
                          u.status === 'active'
                            ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                            : u.status === 'suspended'
                              ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-slate-400 bg-slate-50 cursor-default'
                        }`}
                        disabled={u.status !== 'active' && u.status !== 'suspended'}
                      >
                        {u.status === 'active' ? 'Suspend' : u.status === 'suspended' ? 'Reconnect' : '—'}
                      </button>

                      {/* Three-dot context menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === u.id ? null : u.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpenId === u.id && (
                          <div className="absolute right-0 top-9 z-30 bg-white rounded-xl shadow-xl border border-slate-200/60 min-w-[180px] p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                              onClick={() => { navigate(`/customers/edit/${u.id}`); setMenuOpenId(null); }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
                            >
                              <User className="w-3.5 h-3.5 text-slate-400" /> Edit Customer
                            </button>
                            <button
                              onClick={() => { navigate(`/customers/${u.id}`); setMenuOpenId(null); }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" /> View Profile
                            </button>
                            <button
                              onClick={() => { openSuspend(u); setMenuOpenId(null); }}
                              className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] flex items-center gap-2.5 transition ${
                                u.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              disabled={u.status !== 'active' && u.status !== 'suspended'}
                            >
                              {u.status === 'active'
                                ? <><UserX className="w-3.5 h-3.5" /> Suspend Account</>
                                : <><UserCheck className="w-3.5 h-3.5" /> Reconnect Account</>}
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => { setDeleteModal({ customer: u, loading: false }); setMenuOpenId(null); }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Customer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
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
