import React, { useState } from 'react';
import { 
  Server, Shield, Wifi, Key, Activity, ArrowRight,
  CheckCircle2, Info, ShieldAlert,
  Copy, RefreshCw, AlertTriangle, Radio, Cpu, Terminal, Globe, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Basic Identity
  const [routerName, setRouterName] = useState('');
  const [tunnelIp, setTunnelIp] = useState('10.0.0.3'); // Default suggested IP
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');

  // Status
  const [isHandshaking, setIsHandshaking] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const executeHandshake = async () => {
    setIsHandshaking(true);
    setApiError('');
    try {
      const resp = await apiFetch('/api/router/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: tunnelIp,
          port: '8729',
          username: authUser,
          password: authPass
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || 'Router not reachable on 8729. Check tunnel/firewall.');
      setStep(5);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsHandshaking(false);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    try {
      const body = {
        name: routerName,
        vendor: 'radius', // Standardized vendor type
        conn_type: 'direct',
        ip: tunnelIp,
        port: 8729,
        username: authUser,
        password: authPass,
        vendor_config: { 
            nas_ip: tunnelIp, 
            radius_secret: "Movec@HomeLab#2026!Ke" 
        }
      };

      const resp = await apiFetch('/api/router/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to enroll node');
      navigate('/network/routers');
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const onboardingSteps = [
    { num: 1, title: "Identity" },
    { num: 2, title: "Secure Tunnel" },
    { num: 3, title: "AAA Config" },
    { num: 4, title: "Validation" },
    { num: 5, title: "Deployment" }
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 font-sans">
      <div className="mb-10 text-center animate-in fade-in">
        <h2 className="text-2xl font-light text-slate-800 tracking-tight">Deploy New Node</h2>
        <p className="text-slate-400 mt-2 text-[13px] font-light">Standardized RADIUS + WireGuard deployment pipeline</p>
      </div>

      {/* Stepper */}
      <div className="flex justify-center mb-10 overflow-x-auto pb-4">
         <div className="flex items-center gap-4 whitespace-nowrap">
            {onboardingSteps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center text-[12px] transition-all duration-500 ${step === s.num ? 'text-emerald-600' : 'text-slate-300'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 ${step === s.num ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}>
                    {step > s.num ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : s.num}
                  </span>
                  <span className={step === s.num ? 'font-normal' : 'font-normal opacity-50'}>{s.title}</span>
                </div>
                {i < onboardingSteps.length - 1 && <div className="w-4 h-px bg-slate-100"></div>}
              </React.Fragment>
            ))}
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-h-[500px] flex flex-col overflow-hidden">
        
        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
              <h3 className="text-[17px] font-normal text-slate-700">Router Identity</h3>
              <p className="text-[12px] font-normal text-slate-400 mt-1">Provide the basic identifying information for this node.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-slate-400 uppercase tracking-widest">Site Name</label>
                <input type="text" value={routerName} onChange={(e) => setRouterName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all" placeholder="e.g. 360 Apartments" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-slate-400 uppercase tracking-widest">Tunnel IP (10.0.0.x)</label>
                <input type="text" value={tunnelIp} onChange={(e) => setTunnelIp(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all font-mono" placeholder="10.0.0.3" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-slate-400 uppercase tracking-widest">Admin Username</label>
                <input type="text" value={authUser} onChange={(e) => setAuthUser(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all" placeholder="movec-admin" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-slate-400 uppercase tracking-widest">Admin Password</label>
                <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all" placeholder="••••••••" />
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
               <Info className="w-4 h-4 text-slate-400 mt-0.5" />
               <p className="text-[11px] text-slate-500 leading-relaxed">
                 The <strong>Tunnel IP</strong> is the internal address assigned to this router within the Movec VPN. Admin credentials are encrypted and used only for status monitoring and usage polling.
               </p>
            </div>
          </div>
        )}

        {/* STEP 2: WIREGUARD */}
        {step === 2 && (
          <div className="p-8 space-y-6 animate-in fade-in">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-normal text-slate-700">Security Handshake (WireGuard)</h3>
                  <p className="text-[12px] font-normal text-slate-400 mt-1">Establish a secure link between the hardware and our hub.</p>
                </div>
                <Shield className="w-8 h-8 text-emerald-500/30" strokeWidth={1.5} />
             </div>

             <div className="space-y-4">
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-mono">1. Initialize Tunnel</span>
                    <button onClick={() => copyToClipboard(`/interface wireguard add name=wg-movec listen-port=13231\n/ip address add address=${tunnelIp}/24 interface=wg-movec`, 'wg1')} className="text-slate-500 hover:text-white transition">
                      {copyStatus === 'wg1' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-5 font-mono text-[11px] text-emerald-400/80">
                    /interface wireguard add name=wg-movec listen-port=13231{'\n'}
                    /ip address add address={tunnelIp}/24 interface=wg-movec
                  </pre>
                </div>

                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-mono">2. Connect to Hub</span>
                    <button onClick={() => copyToClipboard(`/interface wireguard peers add interface=wg-movec public-key="ndm4e1CXE3FybrILFj0L5STlJWUW32x61hO4gLSoxhk=" endpoint-address=157.230.96.39 endpoint-port=51820 allowed-address=0.0.0.0/0 persistent-keepalive=25`, 'wg2')} className="text-slate-500 hover:text-white transition">
                       {copyStatus === 'wg2' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-5 font-mono text-[11px] text-emerald-400/80 whitespace-pre-wrap">
                    /interface wireguard peers add interface=wg-movec public-key="ndm4e1CXE3FybrILFj0L5STlJWUW32x61hO4gLSoxhk=" endpoint-address=157.230.96.39 endpoint-port=51820 allowed-address=0.0.0.0/0 persistent-keepalive=25
                  </pre>
                </div>
             </div>
          </div>
        )}

        {/* STEP 3: AAA CONFIG */}
        {step === 3 && (
          <div className="p-8 space-y-6 animate-in fade-in">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[17px] font-normal text-slate-700">AAA & Service Config</h3>
                  <p className="text-[12px] font-normal text-slate-400 mt-1">Configure RADIUS and the PPPoE server for subscriber access.</p>
                </div>
                <Radio className="w-8 h-8 text-blue-500/30" strokeWidth={1.5} />
             </div>

             <div className="space-y-4">
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-mono">1. Link RADIUS Client</span>
                    <button onClick={() => copyToClipboard(`/radius add address=10.0.0.1 secret="Movec@HomeLab#2026!Ke" service=ppp src-address=${tunnelIp} timeout=3000ms\n/ppp aaa set use-radius=yes`, 'radius')} className="text-slate-500 hover:text-white transition">
                       {copyStatus === 'radius' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-5 font-mono text-[11px] text-emerald-400/80">
                    /radius add address=10.0.0.1 secret="Movec@HomeLab#2026!Ke" service=ppp src-address={tunnelIp} timeout=3000ms{'\n'}
                    /ppp aaa set use-radius=yes
                  </pre>
                </div>

                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-mono">2. Authorize Dashboard (API-SSL)</span>
                    <button onClick={() => copyToClipboard(`/ip service set api-ssl port=8729 disabled=no\n/ip firewall filter add chain=input protocol=tcp dst-port=8729 src-address=10.0.0.1 action=accept comment="Allow Movec Dashboard"`, 'api')} className="text-slate-500 hover:text-white transition">
                       {copyStatus === 'api' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-5 font-mono text-[11px] text-emerald-400/80 whitespace-pre-wrap">
                    /ip service set api-ssl port=8729 disabled=no{'\n'}
                    /ip firewall filter add chain=input protocol=tcp dst-port=8729 src-address=10.0.0.1 action=accept comment="Allow Movec Dashboard"
                  </pre>
                </div>
             </div>
          </div>
        )}

        {/* STEP 4: VALIDATION */}
        {step === 4 && (
          <div className="p-8 flex flex-col items-center justify-center py-16 animate-in fade-in text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6">
               <Activity className={`w-8 h-8 ${isHandshaking ? 'text-emerald-500 animate-pulse' : 'text-slate-300'}`} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-light text-slate-800 mb-2">Connectivity Handshake</h3>
            <p className="text-[13px] text-slate-400 max-w-xs mb-10 leading-relaxed">
              We are now attempting to reach the router at <strong>{tunnelIp}</strong> over port <strong>8729</strong>.
            </p>
            
            {apiError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-[11px] mb-8 border border-rose-100 max-w-sm">
                <AlertTriangle className="w-4 h-4 inline mr-2 mb-0.5" />
                {apiError}
              </div>
            )}

            <button 
              onClick={executeHandshake} 
              disabled={isHandshaking}
              className="bg-slate-900 text-white px-12 py-3.5 rounded-2xl text-[13px] font-normal hover:bg-black transition-all flex items-center shadow-lg disabled:opacity-50"
            >
              {isHandshaking ? <RefreshCw className="w-4 h-4 mr-3 animate-spin" /> : <Lock className="w-4 h-4 mr-3" />}
              {isHandshaking ? 'Securing Link...' : 'Execute Handshake'}
            </button>
          </div>
        )}

        {/* STEP 5: DEPLOY */}
        {step === 5 && (
          <div className="p-8 flex flex-col items-center justify-center py-16 animate-in zoom-in duration-700 text-center">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-8">
               <CheckCircle2 className="w-10 h-10 text-emerald-500" strokeWidth={1} />
             </div>
             <h3 className="text-2xl font-light text-slate-800 mb-2">Handshake Successful</h3>
             <p className="text-[14px] text-slate-400 max-w-sm mb-12">The router is authorized and reachable. Proceed to finalize enrollment into your network dashboard.</p>
             <button onClick={handleDeploy} disabled={isDeploying} className="bg-emerald-600 text-white px-14 py-4 rounded-2xl font-normal shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-3">
               {isDeploying ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
               {isDeploying ? 'Finalizing Enrollment...' : 'Enroll Router Node'}
             </button>
          </div>
        )}

        <div className="mt-auto p-6 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
          <button 
            type="button" 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/network/routers')}
            className="text-slate-400 text-[12px] px-2 hover:text-slate-600 transition font-light"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 && (
            <div className="flex flex-col items-end gap-2">
              {apiError && step === 1 && <span className="text-[11px] text-rose-500 font-normal mr-2">Please fill all fields to continue</span>}
              <button 
                onClick={() => {
                  if (step === 1 && (!routerName || !authUser || !authPass || !tunnelIp)) {
                      setApiError('MISSING_FIELDS');
                      return;
                  }
                  setApiError('');
                  setStep(step + 1);
                }} 
                className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-[12px] font-normal shadow-sm hover:bg-black transition-all flex items-center"
              >
                Next Step <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
