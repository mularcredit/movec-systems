import React, { useState, useEffect } from 'react';
import { Search, Plus, Wifi, Shield, Globe, Edit2, Archive, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Package {
  id: string;
  name: string;
  type: string;
  down: number;
  up: number;
  price: number;
  cycle: string;
  ppp_profile: string;
  hs_profile: string;
  is_active: boolean;
}

export default function Packages() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Package | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => { fetchPackages(); }, []);

  const fetchPackages = async () => {
    setLoading(true);

    // Get current user's profile to retrieve their tenant_id
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
      .from('packages')
      .select('id, display_name, service_type, speed_down_mbps, speed_up_mbps, price, billing_cycle_months, router_ppp_profile, router_hotspot_profile, is_active, created_at')
      .eq('is_active', true)
      .eq('tenant_id', tenantId) // STRICT ISOLATION
      .order('created_at', { ascending: false });
    if (data) {
      setPackages(data.map(p => ({
        id:          p.id,
        name:        p.display_name,
        type:        p.service_type,
        down:        p.speed_down_mbps,
        up:          p.speed_up_mbps,
        price:       p.price,
        cycle:       p.billing_cycle_months === 1 ? '30 Days' : `${p.billing_cycle_months} Months`,
        ppp_profile: p.router_ppp_profile     || '—',
        hs_profile:  p.router_hotspot_profile || '—',
        is_active:   p.is_active
      })));
    }
    setLoading(false);
  };

  const filtered = packages.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    // We need to fetch user/tenant_id again or store it in state. Fetching for safety.
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single();

    if (profile?.tenant_id) {
        await supabase.from('packages')
            .update({ is_active: false })
            .eq('id', archiveTarget.id)
            .eq('tenant_id', profile.tenant_id); // STRICT ISOLATION
    }
    setArchiveTarget(null);
    setArchiving(false);
    fetchPackages();
  };

  const TypeBadge = ({ type }: { type: string }) => {
    if (type === 'PPPoE')   return <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full"><Shield className="w-3 h-3"/>PPPoE</span>;
    if (type === 'Hotspot') return <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full"><Wifi className="w-3 h-3"/>Hotspot</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-white/10 text-textSecondary border border-white/10 px-2 py-0.5 rounded-full"><Globe className="w-3 h-3"/>Static</span>;
  };

  return (
    <div className="space-y-6" onClick={() => setMenuOpenId(null)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium text-textPrimary">Internet Packages</h2>
          <p className="text-[13px] text-textSecondary mt-1">Manage bandwidth limits, service types, and RouterOS profile bindings.</p>
        </div>
        <button onClick={() => navigate('/packages/add')} className="btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" /> Create Package
        </button>
      </div>

      <div className="card p-0 flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between bg-bgSecondary rounded-t-xl">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search packages..."
              className="pl-10 input-field"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-16 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Wifi className="w-8 h-8 text-textSecondary mb-4" />
            <h3 className="text-[15px] font-medium text-textPrimary mb-1">No Packages Found</h3>
            <p className="text-[13px] text-textSecondary max-w-sm mb-6">
              {search ? `No packages match "${search}".` : 'Create your first internet package to begin billing customers.'}
            </p>
            {!search && (
              <button onClick={() => navigate('/packages/add')} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" /> Create Package
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-bgSecondary text-textSecondary text-[11px] font-medium uppercase tracking-wider border-b border-white/10">
                <th className="px-5 py-3.5">Display Name</th>
                <th className="px-5 py-3.5 text-center">Type</th>
                <th className="px-5 py-3.5 text-center">Speed (D↓ / U↑)</th>
                <th className="px-5 py-3.5">Router Profile</th>
                <th className="px-5 py-3.5">Price</th>
                <th className="px-5 py-3.5">Cycle</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[13px] text-textPrimary">{pkg.name}</td>
                  <td className="px-5 py-3.5 text-center"><TypeBadge type={pkg.type} /></td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="font-mono text-[12px] font-medium text-textPrimary bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                      {pkg.down}M / {pkg.up}M
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {pkg.type === 'PPPoE'   && <span className="font-mono text-[11px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded">{pkg.ppp_profile}</span>}
                    {pkg.type === 'Hotspot' && <span className="font-mono text-[11px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded">{pkg.hs_profile}</span>}
                    {pkg.type === 'Static'  && <span className="text-[11px] text-textSecondary">N/A</span>}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-[13px] text-emerald-600">Ksh {pkg.price.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-[13px] text-textSecondary">{pkg.cycle}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`/packages/edit/${pkg.id}`)}
                        className="text-[13px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === pkg.id ? null : pkg.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-textSecondary hover:text-textPrimary transition"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        {menuOpenId === pkg.id && (
                          <div className="absolute right-0 top-8 z-20 bg-bgSecondary rounded-xl shadow-xl border border-white/10 min-w-[160px] p-1">
                            <button
                              onClick={() => { setArchiveTarget(pkg); setMenuOpenId(null); }}
                              className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                            >
                              <Archive className="w-3.5 h-3.5" /> Archive Package
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

      {/* Archive Confirmation Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bgSecondary rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-textPrimary">Archive Package?</h3>
                <p className="text-[13px] text-textSecondary mt-1 leading-relaxed">
                  <span className="font-medium text-textPrimary">"{archiveTarget.name}"</span> will be hidden from the UI and no new customers can be assigned to it. Existing subscriptions and billing records will remain intact.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-xl border border-white/10 text-[13px] font-medium text-textSecondary hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-medium hover:bg-amber-600 transition flex items-center gap-2 disabled:opacity-70"
              >
                {archiving ? <><Loader2 className="w-4 h-4 animate-spin" /> Archiving...</> : <><Archive className="w-4 h-4" /> Archive Package</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
