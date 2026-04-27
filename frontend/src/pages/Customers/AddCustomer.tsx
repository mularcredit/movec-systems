import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconAlertTriangle, IconArrowLeft, IconBell, IconBuildingCommunity, IconCalendar, IconChevronRight, IconCircleCheck, IconCreditCard, IconCurrencyDollar, IconHash, IconKey, IconMail, IconMapPin, IconPhone, IconRefresh, IconServer, IconShield, IconTag, IconUserCircle, IconUserPlus, IconWifi } from '@tabler/icons-react';;
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiClient';
import { kenyaLocations } from '../../lib/kenyaLocations';
import { validatePhone, validateEmail, normalizePhone } from '../../lib/validation';
import { Combobox } from '../../components/ui/Combobox';
import { SelectDropdown } from '../../components/ui/SelectDropdown';

const genAccountNumber = () => 'SVC-' + Date.now().toString(36).toUpperCase().slice(-6);
const genPppPassword   = () => Math.random().toString(36).slice(2, 10).toUpperCase();

function defaultDueDate() {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

export default function AddCustomer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const [packages, setPackages] = useState<any[]>([]);
  const [routers,  setRouters]  = useState<any[]>([]);
  const [persons,  setPersons]  = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  // ── Step 1: Identity ─────────────────────────────────────────────────────────
  const [identity, setIdentity] = useState({
    mode: 'new' as 'new' | 'existing',
    id: '', 
    fullName: '', 
    phone: '', 
    email: ''
  });

  // ── Step 2: Location ─────────────────────────────────────────────────────────
  const [location, setLocation] = useState({
    mode: 'new' as 'new' | 'existing',
    property_id: '',
    propertyName: '',
    area: '',
    unitNumber: ''
  });

  // ── Step 3: Service ──────────────────────────────────────────────────────────
  const [service, setService] = useState({
    service_type: 'PPPoE', package_id: '', router_id: '',
    ppp_username: '', ppp_password: genPppPassword(),
    next_due_date: defaultDueDate(), ip_address: '',
    accountNumber: genAccountNumber()
  });

  // ── Step 4: Payment ──────────────────────────────────────────────
  const [payment, setPayment] = useState({
    category: 'full' as 'full' | 'partial' | 'discounted' | 'already_paid',
    amount_paid: '',
    discount_amount: '',
    balance_due_date: '',
    method: 'Cash',
    txn_code: '',
    notes: '',
    send_sms: true,
  });
  const [packagePrice, setPackagePrice] = useState(0);
  const [stkStatus, setStkStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'success'>('idle');
  const [stkError, setStkError] = useState('');
  const [stkPhone, setStkPhone] = useState('');
  const [checkoutId, setCheckoutId] = useState('');
  
  const setP = (k: string, v: any) => setPayment(prev => ({ ...prev, [k]: v }));

  const pollStkStatus = async (id: string) => {
    let attempts = 0;
    const maxAttempts = 20; // 60 seconds (3s * 20)
    
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setStkStatus('error');
        setStkError('Payment confirmation timed out. Please enter transaction code manually.');
        return;
      }

      try {
        const resp = await apiFetch(`/api/mpesa/stk-status/${id}`);
        const data = await resp.json();
        
        if (data.status === 'success') {
          clearInterval(interval);
          setStkStatus('success');
          if (data.transactionCode) setP('txn_code', data.transactionCode);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setStkStatus('error');
          setStkError('Customer cancelled or payment failed.');
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 3000);
  };

  const handleStkPush = async () => {
    setStkStatus('sending');
    setStkError('');
    try {
      const amount = payment.category === 'partial' ? parseFloat(payment.amount_paid || '0') : packagePrice;
      if (amount <= 0) throw new Error('Amount must be greater than 0');

      const targetPhone = stkPhone || identity.phone;
      if (!targetPhone) throw new Error('Phone number is required for STK push');
      
      if (!validatePhone(targetPhone)) {
        throw new Error('Invalid M-Pesa phone number format.');
      }

      const resp = await apiFetch('/api/mpesa/stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: targetPhone,
          amount: amount,
          customer_id: service.accountNumber
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'STK Push failed');
      
      setStkStatus('sent');
      if (data.daraja?.CheckoutRequestID) {
        setCheckoutId(data.daraja.CheckoutRequestID);
        pollStkStatus(data.daraja.CheckoutRequestID);
      }
    } catch (err: any) {
      setStkStatus('error');
      setStkError(err.message);
    }
  };

  useEffect(() => {
    const fetchDeps = async () => {
      const [{ data: pkgs }, { data: prs }, { data: props }, routerRes] = await Promise.all([
        supabase.from('packages').select('id, display_name, price, service_type, speed_down_mbps, speed_up_mbps').eq('is_active', true),
        supabase.from('persons').select('id, full_name, phone').order('full_name'),
        supabase.from('properties').select('id, name, location').order('name'),
        apiFetch('/api/router').then(r => r.json()).catch(() => ({ routers: [] }))
      ]);
      setPackages(pkgs || []);
      setPersons(prs || []);
      setProperties(props || []);
      setRouters(routerRes.routers || []);
    };
    fetchDeps();
  }, []);

  // When package changes, load its price into payment state
  useEffect(() => {
    if (service.package_id) {
      const pkg = packages.find(p => p.id === service.package_id);
      if (pkg) setPackagePrice(parseFloat(pkg.price || 0));
    }
  }, [service.package_id, packages]);


  // Update handlers
  const setI = (k: string, v: string) => setIdentity(prev => ({ ...prev, [k]: v }));
  const setL = (k: string, v: string) => setLocation(prev => ({ ...prev, [k]: v }));
  const setS = (k: string, v: string) => setService(prev => ({ ...prev, [k]: v }));

  // Flow handlers
  const handleNextStep1 = () => {
    const errors: Record<string, string> = {};
    
    if (identity.mode === 'new') {
      if (!identity.fullName.trim()) errors.fullName = 'Full name is required.';
      if (!identity.phone.trim()) errors.phone = 'Phone number is required.';
      
      if (identity.phone && !validatePhone(identity.phone)) {
        errors.phone = 'Invalid Kenyan phone format (e.g. 0712345678)';
      }
      if (identity.email && !validateEmail(identity.email)) {
        errors.email = 'Invalid email address format.';
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      // Check for duplicates in DB by Phone/Email (Exclude Name)
      const checkDuplicate = async () => {
          if (!identity.phone && !identity.email) return false;
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return false;

          const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
          if (!profile?.tenant_id) return false;

          const normalized = normalizePhone(identity.phone.trim());

          // Build OR filter manually to avoid empty matches
          let orFilter = `phone.eq.${identity.phone.trim()},phone.eq.${normalized}`;
          if (identity.email?.trim()) {
            orFilter += `,email.eq.${identity.email.trim()}`;
          }

          const { data: existing } = await supabase
            .from('persons')
            .select('id, full_name, phone, email, services(status)')
            .eq('tenant_id', profile.tenant_id)
            .or(orFilter)
            .limit(1);
          
          if (existing?.[0]) {
              // Check if they have ANY active service
              const services = existing[0].services as any[];
              const hasActiveService = services?.some(s => s.status === 'active' || s.status === 'suspended');

              if (hasActiveService) {
                const matchedPhone = existing[0].phone === identity.phone.trim();
                const field = matchedPhone ? 'phone number' : 'email address';
                setValidationErrors({
                    phone: matchedPhone ? `This ${field} is already registered to ${existing[0].full_name}.` : '',
                    email: !matchedPhone ? `This ${field} is already registered to ${existing[0].full_name}.` : '',
                });
                return true;
              } else {
                // If they exist but have no active services, we'll suggest using the "Existing Customer" 
                // flow but we won't BLOCK them from creating a new record if they prefer.
                // Or better: we'll automatically link to the existing ID to keep the DB clean.
                console.log("Found inactive person, linking automatically...");
                setI('id', existing[0].id);
                // We don't block here, we let them proceed to step 2 with the existing ID linked
              }
          }
          return false;
      };

      checkDuplicate().then(isDup => {
          if (!isDup) {
            setValidationErrors({});
            // Auto-gen ppp username
            if (!service.ppp_username) {
              setS('ppp_username', identity.fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 20));
            }
            setError(''); setStep(2);
          }
      });
      return;
    } else if (identity.mode === 'existing' && !identity.id) {
      errors.id = 'Please select an existing account holder.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
  };

  const handleNextStep2 = () => {
    if (location.mode === 'new' && !location.propertyName) {
      setError('Property name is required.'); return;
    }
    if (location.mode === 'existing' && !location.property_id) {
      setError('Please select an existing property.'); return;
    }
    if (!location.unitNumber) {
      setError('Unit / Apartment number is required.'); return;
    }
    setError(''); setStep(3);
  };

  const handleNextStep3 = () => {
    if (!service.package_id) { setError('Please select a service package.'); return; }
    if (service.service_type !== 'Static' && !service.ppp_username) {
      setError(`${service.service_type} username is required.`); return;
    }
    setError(''); setStep(4);
  };

  const handleSave = async () => {
    setError('');
    if (payment.category === 'partial' && !payment.amount_paid) {
      setError('Enter the amount paid for partial payment.'); return;
    }
    if (payment.category === 'partial' && !payment.balance_due_date) {
      setError('Balance due date is required for partial payments.'); return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/api/services/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity, location, service,
          payment: {
            category:         payment.category,
            amount_paid:      payment.category === 'already_paid' ? packagePrice : parseFloat(payment.amount_paid || '0'),
            discount_amount:  parseFloat(payment.discount_amount || '0'),
            balance_due_date: payment.balance_due_date || null,
            method:           payment.method,
            txn_code:         payment.txn_code || null,
            notes:            payment.notes   || null,
            send_sms:         payment.send_sms,
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 207) {
          setError(`Service created, but provisioning router failed: ${data.error || 'Unknown error'}. Status set to provision_failed.`);
          setTimeout(() => navigate('/customers/all'), 4000);
          return;
        }
        throw new Error(data.error || 'Failed to provision service');
      }

      navigate('/customers/all');
    } catch (e: any) {
      setError(e.message || 'Failed to connect to backend server.');
      setLoading(false);
    }
  };

  const StepIndicator = ({ num, label }: { num: number; label: string }) => (
    <div className={`flex items-center ${step >= num ? 'text-emerald-600' : 'text-textSecondary'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium mr-2 ${step > num ? 'bg-emerald-500 text-white' : step === num ? 'bg-emerald-100 text-emerald-700' : 'bg-white/10'}`}>
        {step > num ? '✓' : num}
      </div>
      <span className="text-[13px] font-medium hidden sm:inline-block">{label}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/customers/all')} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/10 transition shrink-0">
          <IconArrowLeft className="w-4 h-4 text-textSecondary" />
        </button>
        <div>
          <h2 className="text-[18px] font-medium text-textPrimary">Provision Service</h2>
          <p className="text-[13px] text-textSecondary mt-0.5">Deploy a new internet connection tied to an identity and physical unit.</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-3 bg-bgSecondary p-4 rounded-2xl shadow-sm border border-white/10 overflow-x-auto">
        <StepIndicator num={1} label="Identity (Person)" />
        <div className="w-8 sm:w-12 h-px bg-white/10 shrink-0" />
        <StepIndicator num={2} label="Location (Property)" />
        <div className="w-8 sm:w-12 h-px bg-white/10 shrink-0" />
        <StepIndicator num={3} label="Network Service" />
        <div className="w-8 sm:w-12 h-px bg-white/10 shrink-0" />
        <StepIndicator num={4} label="Payment & Finish" />
      </div>

      <div className="card p-0 overflow-hidden shadow-sm border border-white/10">
        <div className="p-6 md:p-8 min-h-[400px]">

          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-start gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="w-9 h-9 rounded-lg bg-bgSecondary shadow-sm border border-emerald-100 flex items-center justify-center shrink-0">
                  <IconUserCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-textPrimary">Account Holder</h3>
                  <p className="text-[12px] text-textSecondary mt-0.5">Who legally owns this service connection?</p>
                </div>
              </div>
              
              <div className="flex p-1 bg-white/10 rounded-lg max-w-sm mb-6">
                <button 
                  onClick={() => setI('mode', 'existing')}
                  className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${identity.mode === 'existing' ? 'bg-bgSecondary text-emerald-600 shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
                >Existing Identity</button>
                <button 
                  onClick={() => setI('mode', 'new')}
                  className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${identity.mode === 'new' ? 'bg-bgSecondary text-emerald-600 shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
                >New Identity</button>
              </div>

              {identity.mode === 'existing' ? (
                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Select Person *</label>
                  <Combobox
                    value={identity.id}
                    onChange={val => setI('id', val)}
                    options={persons.map(p => ({ label: `${p.full_name} (${p.phone})`, value: p.id }))}
                    placeholder="Search account holder..."
                    icon={<IconUserPlus className="w-4 h-4 text-emerald-500" />}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Full Name *</label>
                    <div className="relative">
                      <IconUserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                      <input type="text" value={identity.fullName} onChange={e => setI('fullName', e.target.value)} className={`pl-10 input-field ${validationErrors.fullName ? 'border-rose-300 bg-rose-50/30' : ''}`} placeholder="John Mwangi" />
                    </div>
                    {validationErrors.fullName && <p className="text-[10px] text-rose-500 mt-1 font-medium">{validationErrors.fullName}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Phone Number *</label>
                    <div className="relative">
                      <IconPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                      <input type="text" value={identity.phone} onChange={e => setI('phone', e.target.value)} className={`pl-10 input-field font-mono ${validationErrors.phone ? 'border-rose-300 bg-rose-50/30' : ''}`} placeholder="0712 345 678" />
                    </div>
                    {validationErrors.phone && <p className="text-[10px] text-rose-500 mt-1 font-medium">{validationErrors.phone}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Email Address</label>
                    <div className="relative">
                      <IconMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                      <input type="email" value={identity.email} onChange={e => setI('email', e.target.value)} className={`pl-10 input-field ${validationErrors.email ? 'border-rose-300 bg-rose-50/30' : ''}`} placeholder="john@example.com" />
                    </div>
                    {validationErrors.email && <p className="text-[10px] text-rose-500 mt-1 font-medium">{validationErrors.email}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: LOCATION */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-start gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="w-9 h-9 rounded-lg bg-bgSecondary shadow-sm border border-emerald-100 flex items-center justify-center shrink-0">
                  <IconBuildingCommunity className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-textPrimary">Physical Target</h3>
                  <p className="text-[12px] text-textSecondary mt-0.5">Where is the cable physically terminating?</p>
                </div>
              </div>

              <div className="flex p-1 bg-white/10 rounded-lg max-w-sm mb-6">
                <button 
                  onClick={() => setL('mode', 'existing')}
                  className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${location.mode === 'existing' ? 'bg-bgSecondary text-emerald-600 shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
                >Existing Building</button>
                <button 
                  onClick={() => setL('mode', 'new')}
                  className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${location.mode === 'new' ? 'bg-bgSecondary text-emerald-600 shadow-sm' : 'text-textSecondary hover:text-textPrimary'}`}
                >New Building</button>
              </div>

              {location.mode === 'existing' ? (
                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Select Property / Building *</label>
                  <Combobox
                    value={location.property_id}
                    onChange={val => setL('property_id', val)}
                    options={properties.map(p => ({ label: `${p.name} ${p.location ? `(${p.location})` : ''}`, value: p.id }))}
                    placeholder="Search known property..."
                    icon={<IconBuildingCommunity className="w-4 h-4 text-emerald-500" />}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Property / Building Name *</label>
                    <div className="relative">
                      <IconBuildingCommunity className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                      <input type="text" value={location.propertyName} onChange={e => setL('propertyName', e.target.value)} className="pl-10 input-field" placeholder="e.g., Summit Apartments" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Area / Zone (Kenya)</label>
                    <Combobox
                      value={location.area}
                      onChange={(val) => setL('area', val)}
                      options={kenyaLocations}
                      placeholder="Search area, estate or town..."
                      icon={<IconMapPin className="w-4 h-4 text-emerald-500" />}
                    />
                  </div>
                </div>
              )}

               <div>
                 <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide mt-2">Unit / Door Number *</label>
                 <div className="relative">
                   <IconHash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                   <input type="text" value={location.unitNumber} onChange={e => setL('unitNumber', e.target.value)} className="pl-10 input-field font-mono max-w-[200px]" placeholder="e.g., A4" />
                 </div>
               </div>
            </div>
          )}

          {/* STEP 3: SERVICE INFO */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-start gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="w-9 h-9 rounded-lg bg-bgSecondary shadow-sm border border-emerald-100 flex items-center justify-center shrink-0">
                  <IconShield className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-textPrimary">Internet Parameters</h3>
                  <p className="text-[12px] text-textSecondary mt-0.5">Route this connection to the MikroTik NAS.</p>
                </div>
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-[11px] font-medium text-textSecondary mb-3 uppercase tracking-wide">Connection Logic</label>
                <div className="grid grid-cols-3 gap-3 max-w-lg">
                  {['PPPoE', 'Hotspot', 'Static'].map(t => (
                    <label key={t} className={`cursor-pointer rounded-xl border p-3.5 flex items-center gap-2.5 transition-all ${service.service_type === t ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20' : 'border-white/10 hover:border-white/20'}`}>
                      <input type="radio" value={t} checked={service.service_type === t} onChange={e => setS('service_type', e.target.value)} className="sr-only" />
                      <IconWifi className={`w-4 h-4 shrink-0 ${service.service_type === t ? 'text-emerald-500' : 'text-textSecondary'}`} />
                      <span className={`text-[13px] font-medium ${service.service_type === t ? 'text-emerald-700' : 'text-textSecondary'}`}>{t}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Service Account Num (Auto-Generated)</label>
                  <div className="relative">
                    <IconHash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500 w-4 h-4" />
                    <input type="text" value={service.accountNumber} readOnly className="pl-10 input-field font-mono bg-emerald-50/40 text-textPrimary" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Package *</label>
                  <SelectDropdown
                    value={service.package_id}
                    onChange={val => setS('package_id', val)}
                    options={packages.map(p => ({ label: `${p.display_name} — Ksh ${p.price}/mo`, value: p.id }))}
                    placeholder="Select billing plan..."
                    className="bg-bgSecondary border-white/10"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Network Node (Router)</label>
                  <SelectDropdown
                    value={service.router_id}
                    onChange={val => setS('router_id', val)}
                    options={[
                      { label: '— No Hardware Tied —', value: '' },
                      ...routers.map(r => ({ label: `${r.name} (${r.ip_address})`, value: r.id }))
                    ]}
                    icon={<IconServer className="w-4 h-4" />}
                  />
                </div>

                {service.service_type !== 'Static' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">{service.service_type} Username *</label>
                      <div className="relative">
                        <IconHash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                        <input type="text" value={service.ppp_username} onChange={e => setS('ppp_username', e.target.value)} className="pl-10 input-field font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">{service.service_type} Password</label>
                      <div className="relative">
                        <IconKey className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                        <input type="text" value={service.ppp_password} onChange={e => setS('ppp_password', e.target.value)} className="pl-10 input-field font-mono" />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Static IP (Optional)</label>
                  <div className="relative">
                    <IconServer className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                    <input type="text" value={service.ip_address} onChange={e => setS('ip_address', e.target.value)} className="pl-10 input-field font-mono" placeholder="10.0.0.100" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">First Bill Date</label>
                  <div className="relative">
                    <IconCalendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                    <input type="date" value={service.next_due_date} onChange={e => setS('next_due_date', e.target.value)} className="pl-10 input-field" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: PAYMENT */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-start gap-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="w-9 h-9 rounded-lg bg-bgSecondary shadow-sm border border-emerald-100 flex items-center justify-center shrink-0">
                  <IconCreditCard className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-textPrimary">Payment Selection</h3>
                  <p className="text-[12px] text-textSecondary mt-0.5">How is the customer paying for this setup?</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'full', label: 'Full', icon: <IconCircleCheck className="w-3.5 h-3.5" /> },
                  { id: 'partial', label: 'Partial', icon: <IconHash className="w-3.5 h-3.5" /> },
                  { id: 'discounted', label: 'Discount', icon: <IconTag className="w-3.5 h-3.5" /> },
                  { id: 'already_paid', label: 'Pre-paid', icon: <IconShield className="w-3.5 h-3.5" /> },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setP('category', cat.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${payment.category === cat.id ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20' : 'border-white/10 hover:border-white/20 bg-bgSecondary'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${payment.category === cat.id ? 'bg-emerald-500 text-white' : 'bg-white/10 text-textSecondary'}`}>
                      {cat.icon}
                    </div>
                    <span className={`text-[12px] font-medium ${payment.category === cat.id ? 'text-emerald-700' : 'text-textSecondary'}`}>{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 bg-white/5 rounded-2xl border border-white/10">
                {payment.category === 'full' && (
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Amount to Pay</label>
                    <div className="relative">
                      <IconCurrencyDollar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                      <input type="text" value={`Ksh ${packagePrice.toLocaleString()}`} readOnly className="pl-10 input-field bg-bgSecondary font-medium text-textPrimary" />
                    </div>
                  </div>
                )}

                {payment.category === 'partial' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Amount Paid Now *</label>
                      <div className="relative">
                        <IconCurrencyDollar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                        <input type="number" value={payment.amount_paid} onChange={e => setP('amount_paid', e.target.value)} className="pl-10 input-field bg-bgSecondary" placeholder="e.g. 500" />
                      </div>
                      <p className="text-[11px] text-textSecondary mt-1.5">Remaining: Ksh {(packagePrice - parseFloat(payment.amount_paid || '0')).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Balance Due Date *</label>
                      <div className="relative">
                        <IconCalendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                        <input type="date" value={payment.balance_due_date} onChange={e => setP('balance_due_date', e.target.value)} className="pl-10 input-field bg-bgSecondary" />
                      </div>
                    </div>
                  </>
                )}

                {payment.category === 'discounted' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Discount Amount *</label>
                      <div className="relative">
                        <IconTag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                        <input type="number" value={payment.discount_amount} onChange={e => setP('discount_amount', e.target.value)} className="pl-10 input-field bg-bgSecondary" placeholder="e.g. 200" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Final Price</label>
                      <div className="relative">
                        <IconCurrencyDollar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textSecondary w-4 h-4" />
                        <input type="text" value={`Ksh ${(packagePrice - parseFloat(payment.discount_amount || '0')).toLocaleString()}`} readOnly className="pl-10 input-field bg-bgSecondary/50" />
                      </div>
                    </div>
                  </>
                )}

                {payment.category === 'already_paid' && (
                  <div className="md:col-span-2 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-3">
                    <IconCircleCheck className="w-5 h-5 text-emerald-500" />
                    <p className="text-[13px] text-emerald-700">Customer has already settled the initial payment. This will be recorded as a completed transaction.</p>
                  </div>
                )}

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Payment Method</label>
                    <SelectDropdown
                      value={payment.method}
                      onChange={val => {
                        setP('method', val);
                        if (val !== 'M-Pesa') setStkStatus('idle');
                      }}
                      options={[
                        { label: 'Cash', value: 'Cash' },
                        { label: 'M-Pesa', value: 'M-Pesa' },
                        { label: 'Bank Transfer', value: 'Bank' },
                        { label: 'Cheque', value: 'Cheque' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Transaction Code (Optional)</label>
                    <div className="flex gap-2">
                      <input type="text" value={payment.txn_code} onChange={e => setP('txn_code', e.target.value)} className="input-field bg-bgSecondary flex-1" placeholder="REF: XYZ123" />
                      {payment.method === 'M-Pesa' && (
                        <button
                          type="button"
                          onClick={handleStkPush}
                          disabled={stkStatus === 'sending' || !identity.phone}
                          className={`px-4 rounded-xl text-[12px] font-bold transition-all flex items-center gap-2 shadow-sm border ${
                            stkStatus === 'sent' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                            : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 disabled:opacity-50'
                          }`}
                        >
                          {stkStatus === 'sending' ? (
                            <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                          ) : stkStatus === 'sent' ? (
                            <IconCircleCheck className="w-3.5 h-3.5" />
                          ) : (
                            <IconPhone className="w-3.5 h-3.5" />
                          )}
                          {stkStatus === 'sending' ? 'Sending...' : stkStatus === 'sent' ? 'Prompted' : 'STK Push'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {payment.method === 'M-Pesa' && (
                  <div className="md:col-span-2 p-5 bg-emerald-50/30 border border-emerald-100 rounded-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <IconPhone className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="text-[13px] font-semibold text-emerald-900">M-Pesa STK Prompt</h4>
                        <p className="text-[11px] text-emerald-600">
                          {stkStatus === 'success' ? 'Payment confirmed and verified.' : 'Optionally specify a different number for the prompt.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-emerald-700/60 uppercase mb-1.5 ml-1">Prompt Phone Number</label>
                        <input 
                          type="text" 
                          value={stkPhone} 
                          onChange={e => setStkPhone(e.target.value)} 
                          disabled={stkStatus === 'sending' || stkStatus === 'sent' || stkStatus === 'success'}
                          className="input-field bg-bgSecondary border-emerald-100 text-emerald-900 font-mono disabled:opacity-50" 
                          placeholder={identity.phone || '07xx xxx xxx'} 
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleStkPush}
                          disabled={stkStatus === 'sending' || stkStatus === 'sent' || stkStatus === 'success' || (!stkPhone && !identity.phone)}
                          className={`h-[42px] px-6 rounded-xl text-[13px] font-bold transition-all shadow-sm flex items-center gap-2 ${
                            stkStatus === 'success' 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                          }`}
                        >
                          {stkStatus === 'sending' || stkStatus === 'sent' ? (
                            <IconRefresh className="w-4 h-4 animate-spin" />
                          ) : stkStatus === 'success' ? (
                            <IconCircleCheck className="w-4 h-4" />
                          ) : (
                            <IconPhone className="w-4 h-4" />
                          )}
                          {stkStatus === 'sending' ? 'Sending...' : stkStatus === 'sent' ? 'Waiting...' : stkStatus === 'success' ? 'Confirmed' : 'Send STK Prompt'}
                        </button>
                      </div>
                    </div>

                    {stkStatus === 'sent' && (
                      <div className="p-3 bg-emerald-100/50 border border-emerald-200 rounded-xl text-[12px] text-emerald-700 flex items-center gap-2 animate-pulse">
                        <IconRefresh className="w-4 h-4 animate-spin" />
                        Prompt sent to <strong>{stkPhone || identity.phone}</strong>. Waiting for customer to enter PIN...
                      </div>
                    )}
                    {stkStatus === 'success' && (
                      <div className="p-3 bg-emerald-500 text-white rounded-xl text-[12px] flex items-center gap-2 shadow-md">
                        <IconCircleCheck className="w-4 h-4" />
                        Payment successfully received! Transaction: <strong>{payment.txn_code}</strong>
                      </div>
                    )}
                    {stkError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[12px] text-rose-600 flex items-center gap-2">
                        <IconAlertTriangle className="w-4 h-4" />
                        {stkError}
                      </div>
                    )}
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-medium text-textSecondary mb-2 uppercase tracking-wide">Notes / Reason</label>
                  <textarea value={payment.notes} onChange={e => setP('notes', e.target.value)} className="input-field bg-bgSecondary min-h-[80px] py-3" placeholder="Additional details..."></textarea>
                </div>

                <div className="md:col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={payment.send_sms} 
                        onChange={e => setP('send_sms', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-emerald-500 transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-bgSecondary rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconBell className={`w-4 h-4 ${payment.send_sms ? 'text-emerald-500' : 'text-textSecondary'}`} />
                      <span className="text-[13px] font-medium text-textSecondary group-hover:text-textPrimary transition-colors">Send Welcome SMS to Customer</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {error && <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-700 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full"/>{error}</div>}
        </div>

        <div className="p-4 bg-white/5 border-t border-white/10 flex justify-between items-center px-6 md:px-8">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/customers/all')}
            className="text-[13px] font-medium text-textSecondary hover:text-textPrimary transition"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          
          {step === 1 && <button onClick={handleNextStep1} className="btn-primary flex items-center">Continue <IconChevronRight className="w-4 h-4 ml-1" /></button>}
          {step === 2 && <button onClick={handleNextStep2} className="btn-primary flex items-center">Continue <IconChevronRight className="w-4 h-4 ml-1" /></button>}
          {step === 3 && <button onClick={handleNextStep3} className="btn-primary flex items-center">Payment <IconChevronRight className="w-4 h-4 ml-1" /></button>}
          {step === 4 && (
            <button onClick={handleSave} disabled={loading} className="btn-primary flex items-center shadow-lg shadow-emerald-500/20">
              {loading ? 'Provisioning...' : 'Deploy Service'}
              {!loading && <IconCircleCheck className="w-4 h-4 ml-2" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
