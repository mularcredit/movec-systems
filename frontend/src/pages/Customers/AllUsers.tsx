import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, MoreVertical, ShieldAlert, UserX, UserCheck, Loader2, X, Eye, Trash2, AlertTriangle, User, Wifi, WifiOff } from 'lucide-react';
import CustomLoader from '../../components/common/CustomLoader';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiClient';
import { SelectDropdown } from '../../components/ui/SelectDropdown';

const API = '/api/router';

interface Customer {
  id: string; person_id?: string; account_id: string; name: string; phone: string;
  status: string; balance: number; package: string; package_id: string | null;
  due_date: string;
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
  const [routerFilter, setRouterFilter] = useState('All Routers');
  const [packageFilter, setPackageFilter] = useState('All Packages');
  const [routers, setRouters] = useState<{ id: string, name: string }[]>([]);
  const [packages, setPackages] = useState<{ id: string, name: string }[]>([]);
  const [modal, setModal] = useState<SuspendModal>({ open: false, customer: null, reason: '', loading: false });
  const [deleteModal, setDeleteModal] = useState<{ customer: Customer | null, loading: boolean }>({ customer: null, loading: false });
  const [toast, setToast] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [liveSessions, setLiveSessions] = useState<Set<string>>(new Set());
  const [liveUptime, setLiveUptime] = useState<Map<string, string>>(new Map());

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
          router_id, username, package_id,
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
            package_id: null,
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
              package_id: s.package_id || null,
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

  const fetchFilters = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
    if (!profile) return;

    const [rRes, pRes] = await Promise.all([
      supabase.from('routers').select('id, name').eq('tenant_id', profile.tenant_id).order('name'),
      supabase.from('packages').select('id, display_name').eq('tenant_id', profile.tenant_id).order('display_name')
    ]);

    if (rRes.data) setRouters(rRes.data);
    if (pRes.data) setPackages(pRes.data.map(p => ({ id: p.id, name: p.display_name })));
  };

  useEffect(() => { 
    fetchCustomers(); 
    fetchFilters();
    // Fetch live sessions silently — non-blocking
    apiFetch('/api/sessions/live')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const usernames = new Set<string>(data.sessions.map((s: any) => s.username));
          const uptimes = new Map<string, string>(data.sessions.map((s: any) => [s.username, s.uptime]));
          setLiveSessions(usernames);
          setLiveUptime(uptimes);
        }
      })
      .catch(() => {}); // Fail silently — does not affect rest of page
  }, []);

  const filtered = useMemo(() => {
    return customers.filter(u => {
      const matchStatus = statusFilter === 'All Statuses' || u.status === statusFilter.toLowerCase();
      const matchRouter = routerFilter === 'All Routers' || u.router_id === routerFilter;
      const matchPackage = packageFilter === 'All Packages' || u.package === packageFilter;
      
      const q = search.toLowerCase();
      const matchSearch = !q || u.name.toLowerCase().includes(q) || u.account_id.toLowerCase().includes(q) || (u.phone && u.phone.includes(q));
      
      return matchStatus && matchRouter && matchPackage && matchSearch;
    });
  }, [customers, search, statusFilter, routerFilter, packageFilter]);

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
      pending:   'bg-white/10 text-textSecondary border border-white/10',
      incomplete: 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse',
    };
    return map[status] || 'bg-white/10 text-textSecondary';
  };

  return (
    <div className="space-y-6" onClick={() => setMenuOpenId(null)}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-bgSecondary text-white text-[13px] font-medium px-4 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      {/* Suspend / Reconnect Confirmation Modal */}
      {modal.open && modal.customer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${modal.customer.status === 'active' ? 'bg-rose-500/15' : 'bg-emerald-500/15'}`}>
                  {modal.customer.status === 'active' ? <UserX className="w-5 h-5 text-rose-600" /> : <UserCheck className="w-5 h-5 text-emerald-600" />}
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-textPrimary">
                    {modal.customer.status === 'active' ? 'Suspend Account' : 'Reconnect Account'}
                  </h3>
                  <p className="text-[12px] text-textSecondary mt-0.5">{modal.customer.name}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-textSecondary hover:text-textSecondary"><X className="w-5 h-5" /></button>
            </div>

            {modal.customer.status === 'active' ? (
              <>
                <p className="text-[13px] text-textSecondary mb-4">
                  This will disable the customer's PPP secret on MikroTik and terminate any live session.
                  {!modal.customer.router_id && <span className="text-amber-600"> No router linked — DB only.</span>}
                </p>
                <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Reason</label>
                <input
                  type="text" value={modal.reason}
                  onChange={e => setModal(prev => ({ ...prev, reason: e.target.value }))}
                  className="input-field mb-5" placeholder="e.g. Non-payment — invoice overdue 7 days"
                />
              </>
            ) : (
              <p className="text-[13px] text-textSecondary mb-6">
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-bgSecondary rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200 border border-[rgba(167,139,250,0.18)]">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-[16px] font-medium text-textPrimary">Delete Customer</h3>
                  <p className="text-[12px] text-textSecondary mt-0.5">{deleteModal.customer.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setDeleteModal({ customer: null, loading: false })} 
                className="text-textSecondary hover:text-textSecondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[13px] text-textSecondary mb-6">
              Are you sure you want to permanently remove <span className="font-semibold text-textPrimary">{deleteModal.customer.name}</span> from the system?<br/><br/>
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
          <h2 className="text-[18px] font-medium text-textPrimary">All Customers</h2>
          <p className="text-[13px] text-textSecondary mt-1">{customers.length} total subscriber{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/customers/add')} className="btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Onboard Customer
        </button>
      </div>

      <div className="card p-0 flex flex-col">
        {/* Search & Filter */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center gap-3 bg-bgSecondary rounded-t-xl">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, account ID, or phone..." className="pl-10 input-field" />
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={['All Statuses', 'Active', 'Suspended', 'Pending', 'Expired']}
            className="w-full sm:max-w-[140px]"
          />
          <SelectDropdown
            value={routerFilter}
            onChange={setRouterFilter}
            options={['All Routers', ...routers.map(r => ({ label: r.name, value: r.id }))]}
            className="w-full sm:max-w-[180px]"
          />
          <SelectDropdown
            value={packageFilter}
            onChange={setPackageFilter}
            options={['All Packages', ...packages.map(p => p.name)]}
            className="w-full sm:max-w-[180px]"
          />
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <CustomLoader message="Loading subscriber database..." />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <ShieldAlert className="w-8 h-8 text-textSecondary mb-4" />
            <h3 className="text-[15px] font-medium text-textPrimary mb-1">{search || statusFilter !== 'All Statuses' ? 'No matches found' : 'No Customers Registered'}</h3>
            <p className="text-[13px] text-textSecondary max-w-sm mb-6">
              {search ? `No customers match "${search}".` : 'Onboard your first subscriber to get started.'}
            </p>
            {!search && statusFilter === 'All Statuses' && (
              <button onClick={() => navigate('/customers/add')} className="btn-primary"><Plus className="w-4 h-4 mr-2" /> Onboard Customer</button>
            )}
          </div>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Package</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Online</th>
                <th className="px-5 py-3.5 text-right">Balance</th>
                <th className="px-5 py-3.5">Next Bill</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-[13px] text-textPrimary">{u.name}</p>
                    <p className="text-[11px] text-textSecondary font-mono mt-0.5">{u.account_id}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-textSecondary">{u.phone}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-[11px] font-medium bg-white/10 text-textSecondary px-2 py-0.5 rounded">{u.package}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize ${statusBadge(u.status)}`}>{u.status}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {u.username && liveSessions.has(u.username) ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-normal">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          Online
                        </span>
                        <span className="text-[9px] text-textSecondary font-mono">{liveUptime.get(u.username) || ''}</span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-[10px] text-textSecondary font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/10 inline-block" />
                        Offline
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-[13px]">
                    {parseFloat(String(u.balance)) > 0
                      ? <span className="text-rose-600">Ksh {u.balance}</span>
                      : parseFloat(String(u.balance)) < 0
                        ? <span className="text-emerald-600">Ksh {Math.abs(parseFloat(String(u.balance))).toFixed(2)} CR</span>
                        : <span className="text-textSecondary">Ksh 0</span>}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-textSecondary font-medium">{u.due_date}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Suspend/Reconnect toggle switch */}
                      <button
                        onClick={() => openSuspend(u)}
                        disabled={u.status !== 'active' && u.status !== 'suspended'}
                        title={u.status === 'active' ? 'Click to suspend' : u.status === 'suspended' ? 'Click to reconnect' : ''}
                        className={`relative inline-flex items-center rounded-full transition-all duration-300 focus:outline-none ${
                          u.status !== 'active' && u.status !== 'suspended'
                            ? 'cursor-default opacity-30'
                            : 'cursor-pointer'
                        }`}
                        style={{ width: '36px', height: '20px' }}
                      >
                        <span className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                          u.status === 'active' ? 'bg-emerald-500' : 'bg-white/15'
                        }`} />
                        <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ${
                          u.status === 'active'
                            ? 'translate-x-4 bg-white'
                            : 'translate-x-0 bg-white/40'
                        }`} />
                      </button>

                      {/* Three-dot context menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === u.id ? null : u.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-textSecondary hover:text-textPrimary transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpenId === u.id && (
                          <div className="absolute right-0 top-9 z-30 bg-bgSecondary rounded-xl shadow-xl border border-white/10 min-w-[180px] p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <button
                              onClick={() => { navigate(`/customers/edit/${u.id}`); setMenuOpenId(null); }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-textPrimary hover:bg-white/5 flex items-center gap-2.5 transition"
                            >
                              <User className="w-3.5 h-3.5 text-textSecondary" /> Edit Customer
                            </button>
                            <button
                              onClick={() => { navigate(`/customers/${u.id}`); setMenuOpenId(null); }}
                              className="w-full text-left px-3 py-2.5 rounded-lg text-[13px] text-textPrimary hover:bg-white/5 flex items-center gap-2.5 transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-textSecondary" /> View Profile
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
                            <div className="border-t border-white/5 my-1" />
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
