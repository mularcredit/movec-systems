import React, { useState } from 'react';
import { 
  Server, Shield, Wifi, Key, Activity, ArrowRight,
  CheckCircle2, Info, ShieldAlert,
  Copy, RefreshCw, AlertTriangle, Radio, Cpu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const [vendor, setVendor] = useState<'mikrotik' | 'radius'>('mikrotik');
  const [connType, setConnType] = useState('wireguard');
  const [tikPublicKey, setTikPublicKey] = useState('');
  const [directIp, setDirectIp] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [routerName, setRouterName] = useState('');
  const [apiPort, setApiPort] = useState('8728');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');

  const [nasIp, setNasIp] = useState('');
  const [radiusSecret, setRadiusSecret] = useState('');

  const [isHandshaking, setIsHandshaking] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const getTargetIp = () => connType === 'wireguard' ? '10.9.35.31' : directIp;

  const executeHandshake = async () => {
    setIsHandshaking(true);
    setApiError('');
    try {
      const resp = await apiFetch('/api/router/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: getTargetIp(),
          port: apiPort,
          username: authUser,
          password: authPass
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Connection failed');
      setStep(6);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsHandshaking(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const body: any = {
        name: routerName,
        vendor,
        conn_type: vendor === 'radius' ? 'direct' : connType,
      };

      if (vendor === 'mikrotik') {
        body.ip = getTargetIp();
        body.port = apiPort;
        body.username = authUser;
        body.password = authPass;
      } else {
        body.ip = nasIp;
        body.port = 1812;
        body.vendor_config = { nas_ip: nasIp, radius_secret: radiusSecret };
      }

      const resp = await apiFetch('/api/router/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to save');
      navigate('/network/routers');
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const mikrotikSteps = [
    { num: 1, title: "Vendor" }, { num: 2, title: "Prerequisites" },
    { num: 3, title: "Configuration" }, { num: 4, title: "Credentials" },
    { num: 5, title: "Validation" }, { num: 6, title: "Deploy" }
  ];
  const radiusSteps = [
    { num: 1, title: "Vendor" }, { num: 2, title: "NAS config" },
    { num: 3, title: "Identity" }, { num: 4, title: "Deploy" }
  ];
  const steps = vendor === 'radius' ? radiusSteps : mikrotikSteps;

  return (
    <div className="max-w-4xl mx-auto py-8 font-sans">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-light text-slate-800 tracking-tight">Add new router node</h2>
        <p className="text-slate-400 mt-2 text-[13px]">Link a network gateway to the Movec Connect platform</p>
      </div>

      <div className="flex justify-center mb-10 overflow-x-auto pb-4">
         <div className="flex items-center gap-4 whitespace-nowrap">
            {steps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center text-[12px] transition-all duration-500 ${step === s.num ? 'text-emerald-500' : 'text-slate-300'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 ${step === s.num ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}>
                    {step > s.num ? <CheckCircle2 className="w-3 h-3" /> : s.num}
                  </span>
                  {s.title}
                </div>
                {i < steps.length - 1 && <div className="w-4 h-px bg-slate-100"></div>}
              </React.Fragment>
            ))}
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.01)] min-h-[500px] flex flex-col overflow-hidden">
        
        {step === 1 && (
          <div className="space-y-6 p-8 animate-in fade-in duration-500">
            <div>
              <h3 className="text-[17px] font-normal text-slate-700">Select hardware vendor</h3>
              <p className="text-[12px] text-slate-400 mt-1">Choose how this router integrates with the platform.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className={`cursor-pointer rounded-xl border p-6 transition-all ${vendor === 'mikrotik' ? 'border-emerald-500/50 bg-emerald-50/20' : 'border-slate-100 hover:border-slate-200'}`}
                onClick={() => setVendor('mikrotik')}
              >
                <Cpu className={`w-5 h-5 mb-4 ${vendor === 'mikrotik' ? 'text-emerald-500' : 'text-slate-300'}`} strokeWidth={1.5} />
                <h4 className="text-[14px] font-normal text-slate-700">MikroTik RouterOS</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Direct socket API control. Full PPPoE and session management.</p>
              </div>

              <div 
                className={`cursor-pointer rounded-xl border p-6 transition-all ${vendor === 'radius' ? 'border-blue-500/50 bg-blue-50/20' : 'border-slate-100 hover:border-slate-200'}`}
                onClick={() => setVendor('radius')}
              >
                <Radio className={`w-5 h-5 mb-4 ${vendor === 'radius' ? 'text-blue-500' : 'text-slate-300'}`} strokeWidth={1.5} />
                <h4 className="text-[14px] font-normal text-slate-700">RADIUS / Generic NAS</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Vendor-agnostic. Works with Ruijie, Huawei, and TP-Link.</p>
              </div>
            </div>
          </div>
        )}

        {vendor === 'mikrotik' && step === 2 && (
          <div className="space-y-6 p-8 animate-in fade-in">
             <div className="bg-amber-50/30 p-5 rounded-xl border border-amber-100/50 flex gap-4">
               <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" strokeWidth={1.5} />
               <div>
                  <h3 className="text-[14px] font-normal text-amber-800">Prerequisites</h3>
                  <p className="text-[12px] text-amber-700/70 mt-0.5">Ensure your MikroTik is running v7.x+ and has API-SSL enabled.</p>
               </div>
             </div>

             <div className="space-y-3">
                <p className="text-[12px] text-slate-500">1. Enable secure API transport</p>
                <div className="relative">
                  <pre className="bg-slate-900 p-4 rounded-xl font-mono text-[11px] text-emerald-400/80 overflow-x-auto shadow-inner">
                    /ip service enable api-ssl{'\n'}/ip service disable api
                  </pre>
                  <button onClick={() => copyToClipboard('/ip service enable api-ssl\n/ip service disable api', 'ssl')} className="absolute top-3 right-3 text-slate-500 hover:text-white transition"><Copy className="w-3.5 h-3.5" /></button>
                </div>
             </div>
          </div>
        )}

        {vendor === 'mikrotik' && step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in">
            <h3 className="text-[17px] font-normal text-slate-700">Tunneling architecture</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className={`cursor-pointer rounded-xl border p-5 transition-all ${connType === 'direct' ? 'border-emerald-500/50 bg-emerald-50/10' : 'border-slate-100'}`}>
                <input type="radio" value="direct" checked={connType === 'direct'} onChange={(e) => setConnType(e.target.value)} className="sr-only" />
                <Wifi className="w-4 h-4 mb-2 text-slate-400" strokeWidth={1.5} />
                <p className="text-[13px] font-normal">Direct IP</p>
              </label>
              <label className={`cursor-pointer rounded-xl border p-5 transition-all ${connType === 'wireguard' ? 'border-emerald-500/50 bg-emerald-50/10' : 'border-slate-100'}`}>
                <input type="radio" value="wireguard" checked={connType === 'wireguard'} onChange={(e) => setConnType(e.target.value)} className="sr-only" />
                <Shield className="w-4 h-4 mb-2 text-slate-400" strokeWidth={1.5} />
                <p className="text-[13px] font-normal">WireGuard VPN</p>
              </label>
            </div>
            {connType === 'wireguard' && (
              <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">CLI Instructions</span>
                </div>
                <div className="p-5 font-mono text-[11px] text-emerald-400/70 space-y-2">
                  <p># Create WireGuard tunnel</p>
                  <p>/interface wireguard add name=wg-billing listen-port=0</p>
                </div>
              </div>
            )}
          </div>
        )}

        {vendor === 'mikrotik' && step === 4 && (
          <div className="p-8 space-y-6 animate-in fade-in">
            <h3 className="text-[17px] font-normal text-slate-700">Router credentials</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">Router name</label>
                <input type="text" value={routerName} onChange={(e) => setRouterName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="e.g. Westlands Branch" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">API port (SSL)</label>
                <input type="text" value={apiPort} onChange={(e) => setApiPort(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="8729" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">Username</label>
                <input type="text" value={authUser} onChange={(e) => setAuthUser(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="movec-api" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">Password</label>
                <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="••••••••" />
              </div>
            </div>
          </div>
        )}

        {vendor === 'mikrotik' && step === 5 && (
          <div className="p-8 flex flex-col items-center justify-center py-12 animate-in fade-in text-center">
            <Activity className="w-12 h-12 text-emerald-500 mb-6" strokeWidth={1} />
            <h3 className="text-xl font-light text-slate-800 mb-2">Validate connection</h3>
            <p className="text-[13px] text-slate-400 max-w-xs mb-8">We will perform a handshake with {getTargetIp()} to verify credentials.</p>
            
            {apiError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-[12px] mb-6 border border-rose-100">
                {apiError}
              </div>
            )}

            <button 
              onClick={executeHandshake} 
              disabled={isHandshaking}
              className="bg-slate-800 text-white px-10 py-3 rounded-xl text-[13px] font-normal hover:bg-slate-900 transition-all flex items-center shadow-lg"
            >
              {isHandshaking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
              {isHandshaking ? 'Verifying...' : 'Start handshake'}
            </button>
          </div>
        )}

        {vendor === 'radius' && step === 2 && (
          <div className="p-8 space-y-6 animate-in fade-in">
            <h3 className="text-[17px] font-normal text-slate-700">NAS configuration</h3>
            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-xl space-y-3">
               <p className="text-[12px] text-blue-700 font-medium">Point your device to:</p>
               <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
                  <div className="text-slate-500">RADIUS Server: <span className="text-blue-600">213.188.220.233</span></div>
                  <div className="text-slate-500">Auth Port: <span className="text-blue-600">1812</span></div>
               </div>
            </div>
          </div>
        )}

        {vendor === 'radius' && step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in">
            <h3 className="text-[17px] font-normal text-slate-700">Identify node</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">Site name</label>
                <input type="text" value={routerName} onChange={(e) => setRouterName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="e.g. Tenda Gateway" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">NAS IP (Device IP)</label>
                <input type="text" value={nasIp} onChange={(e) => setNasIp(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="192.168.1.1" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] text-slate-500">RADIUS shared secret</label>
                <input type="text" value={radiusSecret} onChange={(e) => setRadiusSecret(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-[13px] outline-none focus:border-emerald-500/50 transition-all" placeholder="Secret key" />
              </div>
            </div>
          </div>
        )}

        {step === (vendor === 'radius' ? 4 : 6) && (
          <div className="p-8 flex flex-col items-center justify-center py-16 animate-in zoom-in duration-700">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-8">
               <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={1.5} />
             </div>
             <h3 className="text-2xl font-light text-slate-800 mb-2">Ready to deploy</h3>
             <p className="text-[14px] text-slate-400 text-center max-w-sm mb-10">Verification complete. Proceed to enroll this node into the live dashboard.</p>
             <button onClick={handleDeploy} disabled={isDeploying} className="bg-emerald-600 text-white px-12 py-3 rounded-xl font-normal shadow-sm hover:bg-emerald-700 transition-all">
               {isDeploying ? 'Linking...' : 'Link router now'}
             </button>
          </div>
        )}

        <div className="mt-auto p-6 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
          <button 
            type="button" 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/network/routers')}
            className="text-slate-400 text-[12px] px-2 hover:text-slate-600 transition"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < (vendor === 'radius' ? 4 : 6) && step !== 5 && (
            <button 
              onClick={() => setStep(step + 1)} 
              className="bg-slate-800 text-white px-8 py-2.5 rounded-xl text-[12px] font-normal shadow-sm hover:bg-slate-800 transition-all flex items-center"
            >
              Continue <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
