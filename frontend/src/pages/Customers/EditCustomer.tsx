import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Phone, Mail, MapPin, Hash, Package, 
  Server, Lock, Calendar, Loader2, Save, ArrowLeft,
  Wifi, Shield, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiClient';
import { SelectDropdown } from '../../components/ui/SelectDropdown';

export default function EditCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  const [packageId, setPackageId] = useState('');
  const [routerId, setRouterId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [serviceType, setServiceType] = useState('PPPoE');

  // Options
  const [packages, setPackages] = useState<any[]>([]);
  const [routers, setRouters] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Packages & Routers
        const [pkgs, rtrs] = await Promise.all([
          supabase.from('packages').select('*').order('display_name'),
          supabase.from('routers').select('*').order('name')
        ]);
        setPackages(pkgs.data || []);
        setRouters(rtrs.data || []);

        // 2. Fetch Customer Details
        const { data: customer, error: custErr } = await supabase
          .from('services')
          .select('*, persons(*)')
          .eq('id', id)
          .single();

        if (custErr || !customer) throw new Error('Customer not found');

        setFullName(customer.persons?.full_name || '');
        setPhone(customer.persons?.phone || '');
        setEmail(customer.persons?.email || '');
        setAddress(customer.address || '');
        setAccountNumber(customer.account_number);
        setPackageId(customer.package_id || '');
        setRouterId(customer.router_id || '');
        setUsername(customer.username || '');
        setIpAddress(customer.ip_address || '');
        setDueDate(customer.next_due_date || '');
        setServiceType(customer.service_type || 'PPPoE');

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await apiFetch(`/api/customers/update/${id}`, {
        method: 'POST',
        body: JSON.stringify({
          profile: {
            fullName,
            phone,
            email,
            address,
            accountNumber
          },
          service: {
            package_id: packageId,
            router_id: routerId,
            ppp_username: username,
            ppp_password: password || undefined, // Only send if changed
            ip_address: ipAddress,
            next_due_date: dueDate
          }
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update customer');

      navigate(`/customers/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-textSecondary font-medium">Retrieving subscriber data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition text-textSecondary hover:text-textSecondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-[20px] font-semibold text-textPrimary">Edit Subscriber</h2>
            <p className="text-[13px] text-textSecondary mt-1">Update profile and network configuration for {fullName}</p>
          </div>
        </div>
        <button 
          form="edit-form"
          disabled={saving}
          className="btn-primary flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving Changes...' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-[13px] font-medium">{error}</p>
        </div>
      )}

      <form id="edit-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Information */}
        <div className="card p-6 lg:p-8">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-textPrimary">Subscriber Profile</h3>
              <p className="text-[12px] text-textSecondary mt-0.5">Personal and contact information</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Full Name
              </label>
              <input 
                type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                className="input-field" placeholder="e.g. John Doe" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" /> Account Number
              </label>
              <input 
                type="text" required value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                className="input-field bg-white/5 cursor-not-allowed" readOnly
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </label>
              <input 
                type="tel" required value={phone} onChange={e => setPhone(e.target.value)}
                className="input-field" placeholder="e.g. 254712345678" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" /> Email Address (Optional)
              </label>
              <input 
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="e.g. john@example.com" 
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Physical Address
              </label>
              <input 
                type="text" value={address} onChange={e => setAddress(e.target.value)}
                className="input-field" placeholder="e.g. House 45, Green Estate" 
              />
            </div>
          </div>
        </div>

        {/* Network & Billing */}
        <div className="card p-6 lg:p-8 border-emerald-100 shadow-emerald-500/5">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-textPrimary">Service Configuration</h3>
              <p className="text-[12px] text-textSecondary mt-0.5">Router and subscription plan details</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Package className="w-3.5 h-3.5" /> Service Plan
              </label>
              <SelectDropdown 
                value={packageId} 
                onChange={setPackageId}
                options={packages.map(p => ({ label: p.display_name, value: p.id }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Server className="w-3.5 h-3.5" /> Assignment Router
              </label>
              <SelectDropdown 
                value={routerId} 
                onChange={setRouterId}
                options={routers.map(r => ({ label: r.name, value: r.id }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> PPPoE/Hotspot Username
              </label>
              <input 
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                className="input-field" placeholder="e.g. john.doe" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> New Password (Leave blank to keep current)
              </label>
              <input 
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input-field" placeholder="••••••••" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> Static IP Address (Optional)
              </label>
              <input 
                type="text" value={ipAddress} onChange={e => setIpAddress(e.target.value)}
                className="input-field" placeholder="e.g. 192.168.88.50" 
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-semibold text-textSecondary uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Next Due Date
              </label>
              <input 
                type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
