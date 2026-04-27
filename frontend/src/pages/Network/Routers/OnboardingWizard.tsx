import React, { useState } from 'react';
import { IconActivity, IconAlertTriangle, IconArrowRight, IconCircleCheck, IconCopy, IconCpu, IconGlobe, IconInfoCircle, IconKey, IconLock, IconRefresh, IconRouter, IconServer, IconShield, IconShieldX, IconTerminal2, IconWifi } from '@tabler/icons-react';;
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Basic Identity
  const [routerName, setRouterName] = useState('');
  const [tunnelIp, setTunnelIp] = useState('');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [radiusSecret, setRadiusSecret] = useState('');

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
            radius_secret: radiusSecret 
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
        <h2 className="text-2xl font-light text-textPrimary tracking-tight">Deploy New Node</h2>
        <p className="text-textSecondary mt-2 text-[13px] font-light">Standardized RADIUS + WireGuard deployment pipeline</p>
      </div>

      {/* Stepper */}
      <div className="flex justify-center mb-10 overflow-x-auto pb-4">
         <div className="flex items-center gap-4 whitespace-nowrap">
            {onboardingSteps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center text-[12px] transition-all duration-500 ${step === s.num ? 'text-emerald-600' : 'text-textSecondary'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2 ${step === s.num ? 'bg-emerald-50 border border-emerald-100' : 'bg-white/5 border border-white/5'}`}>
                    {step > s.num ? <IconCircleCheck className="w-3 h-3 text-emerald-500" /> : s.num}
                  </span>
                  <span className={step === s.num ? 'font-normal' : 'font-normal opacity-50'}>{s.title}</span>
                </div>
                {i < onboardingSteps.length - 1 && <div className="w-4 h-px bg-white/10"></div>}
              </React.Fragment>
            ))}
         </div>
      </div>

      <div className="bg-bgSecondary rounded-2xl border border-white/5 shadow-sm min-h-[500px] flex flex-col overflow-hidden">
        
        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="p-8 space-y-8 animate-in fade-in duration-500">
            
            {/* Visual Diagram */}
            <div className="flex items-center justify-center py-8 px-4 gap-2 sm:gap-6 bg-[#0B0914]/50 border border-[rgba(167,139,250,0.1)] rounded-2xl mb-8 shadow-inner overflow-hidden relative">
              
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.03)] to-transparent pointer-events-none"></div>

              <div className="flex flex-col items-center relative z-10">
                <img src="/pngwing.com (2).png" alt="Movec Antenna" className="h-16 md:h-24 w-auto object-contain drop-shadow-[0_0_15px_rgba(167,139,250,0.4)]" />
                <span className="text-[10px] text-textSecondary mt-3 uppercase tracking-widest font-medium">Movec Hub</span>
              </div>
              
              <div className="flex-1 max-w-[60px] sm:max-w-[120px] h-[2px] bg-white/5 relative overflow-hidden rounded-full">
                <div className="absolute top-0 left-0 h-full w-full animate-data-flow"></div>
              </div>

              <div className="flex flex-col items-center relative z-10">
                <img src="/pngwing.com (1).png" alt="MikroTik Router" className="h-14 md:h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(52,211,153,0.2)]" />
                <span className="text-[10px] text-textSecondary mt-3 uppercase tracking-widest font-medium">MikroTik Gateway</span>
              </div>

              <div className="flex-1 max-w-[60px] sm:max-w-[120px] h-[2px] bg-white/5 relative overflow-hidden rounded-full">
                <div className="absolute top-0 left-0 h-full w-full animate-data-flow" style={{ animationDelay: '0.5s' }}></div>
              </div>

              <div className="flex flex-col items-center relative z-10">
                <img src="/pngwing.com.png" alt="PPPoE Client" className="h-12 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(96,165,250,0.2)]" />
                <span className="text-[10px] text-textSecondary mt-3 uppercase tracking-widest font-medium">PPPoE Client</span>
              </div>
            </div>

            <div>
              <h3 className="text-[17px] font-normal text-textPrimary">Router Identity</h3>
              <p className="text-[12px] font-normal text-textSecondary mt-1">Provide the basic identifying information for this node.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-textSecondary uppercase tracking-widest">Site Name</label>
                <input type="text" value={routerName} onChange={(e) => setRouterName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all" placeholder="e.g. 360 Apartments" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-textSecondary uppercase tracking-widest">Tunnel IP (10.0.0.x)</label>
                <input type="text" value={tunnelIp} onChange={(e) => setTunnelIp(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all font-mono" placeholder="10.0.0.3" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-textSecondary uppercase tracking-widest">Admin Username</label>
                <input type="text" value={authUser} onChange={(e) => setAuthUser(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all" placeholder="movec-admin" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-textSecondary uppercase tracking-widest">Admin Password</label>
                <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all" placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-normal text-textSecondary uppercase tracking-widest">RADIUS Shared Secret</label>
                <input type="text" value={radiusSecret} onChange={(e) => setRadiusSecret(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-[13px] outline-none focus:border-emerald-500/30 transition-all font-mono" placeholder="Secret key" />
              </div>
            </div>
            
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-start gap-3">
               <IconInfoCircle className="w-4 h-4 text-textSecondary mt-0.5" />
               <p className="text-[11px] text-textSecondary leading-relaxed">
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
                  <h3 className="text-[17px] font-normal text-textPrimary">Security Handshake (WireGuard)</h3>
                  <p className="text-[12px] font-normal text-textSecondary mt-1">Establish a secure link between the hardware and our hub.</p>
                </div>
                <IconShield className="w-8 h-8 text-emerald-500/30" strokeWidth={1.5} />
             </div>

             <div className="space-y-4">
                <div className="bg-bgPrimary rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-textSecondary font-mono">1. Initialize Tunnel</span>
                    <button onClick={() => copyToClipboard(`/interface wireguard add name=wg-movec listen-port=13231\n/ip address add address=${tunnelIp}/24 interface=wg-movec`, 'wg1')} className="text-textSecondary hover:text-white transition">
                      {copyStatus === 'wg1' ? <IconCircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-5 font-mono text-[11px] text-emerald-400/80">
                    /interface wireguard add name=wg-movec listen-port=13231{'\n'}
                    /ip address add address={tunnelIp}/24 interface=wg-movec
                  </pre>
                </div>

                <div className="bg-bgPrimary rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-textSecondary font-mono">2. Connect to Hub</span>
                    <button onClick={() => copyToClipboard(`/interface wireguard peers add interface=wg-movec public-key="ndm4e1CXE3FybrILFj0L5STlJWUW32x61hO4gLSoxhk=" endpoint-address=157.230.96.39 endpoint-port=51820 allowed-address=0.0.0.0/0 persistent-keepalive=25`, 'wg2')} className="text-textSecondary hover:text-white transition">
                       {copyStatus === 'wg2' ? <IconCircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
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
                  <h3 className="text-[17px] font-normal text-textPrimary">AAA & Service Config</h3>
                  <p className="text-[12px] font-normal text-textSecondary mt-1">Configure RADIUS and the PPPoE server for subscriber access.</p>
                </div>
                <IconRouter className="w-8 h-8 text-blue-500/30" strokeWidth={1.5} />
             </div>

             <div className="space-y-4">
                <div className="bg-bgPrimary rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-textSecondary font-mono">1. Link RADIUS Client</span>
                    <button onClick={() => copyToClipboard(`/radius add address=10.0.0.1 secret="${radiusSecret}" service=ppp src-address=${tunnelIp} timeout=3000ms\n/ppp aaa set use-radius=yes`, 'radius')} className="text-textSecondary hover:text-white transition">
                       {copyStatus === 'radius' ? <IconCircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <pre className="p-5 font-mono text-[11px] text-emerald-400/80">
                    /radius add address=10.0.0.1 secret="{radiusSecret}" service=ppp src-address={tunnelIp} timeout=3000ms{'\n'}
                    /ppp aaa set use-radius=yes
                  </pre>
                </div>

                <div className="bg-bgPrimary rounded-xl overflow-hidden shadow-inner">
                  <div className="px-4 py-2 bg-slate-950 border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] text-textSecondary font-mono">2. Authorize Dashboard (API-SSL)</span>
                    <button onClick={() => copyToClipboard(`/ip service set api-ssl port=8729 disabled=no\n/ip firewall filter add chain=input protocol=tcp dst-port=8729 src-address=10.0.0.1 action=accept comment="Allow Movec Dashboard"`, 'api')} className="text-textSecondary hover:text-white transition">
                       {copyStatus === 'api' ? <IconCircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <IconCopy className="w-3.5 h-3.5" />}
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
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
               <IconActivity className={`w-8 h-8 ${isHandshaking ? 'text-emerald-500 animate-pulse' : 'text-textSecondary'}`} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-light text-textPrimary mb-2">Connectivity Handshake</h3>
            <p className="text-[13px] text-textSecondary max-w-xs mb-10 leading-relaxed">
              We are now attempting to reach the router at <strong>{tunnelIp}</strong> over port <strong>8729</strong>.
            </p>
            
            {apiError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-[11px] mb-8 border border-rose-100 max-w-sm">
                <IconAlertTriangle className="w-4 h-4 inline mr-2 mb-0.5" />
                {apiError}
              </div>
            )}

            <button 
              onClick={executeHandshake} 
              disabled={isHandshaking}
              className="bg-bgPrimary text-white px-12 py-3.5 rounded-2xl text-[13px] font-normal hover:bg-black transition-all flex items-center shadow-lg disabled:opacity-50"
            >
              {isHandshaking ? <IconRefresh className="w-4 h-4 mr-3 animate-spin" /> : <IconLock className="w-4 h-4 mr-3" />}
              {isHandshaking ? 'Securing Link...' : 'Execute Handshake'}
            </button>
          </div>
        )}

        {/* STEP 5: DEPLOY */}
        {step === 5 && (
          <div className="p-8 flex flex-col items-center justify-center py-16 animate-in zoom-in duration-700 text-center">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mb-8">
               <IconCircleCheck className="w-10 h-10 text-emerald-500" strokeWidth={1} />
             </div>
             <h3 className="text-2xl font-light text-textPrimary mb-2">Handshake Successful</h3>
             <p className="text-[14px] text-textSecondary max-w-sm mb-12">The router is authorized and reachable. Proceed to finalize enrollment into your network dashboard.</p>
             <button onClick={handleDeploy} disabled={isDeploying} className="bg-emerald-600 text-white px-14 py-4 rounded-2xl font-normal shadow-sm hover:bg-emerald-700 transition-all flex items-center gap-3">
               {isDeploying ? <IconRefresh className="w-5 h-5 animate-spin" /> : <IconGlobe className="w-5 h-5" />}
               {isDeploying ? 'Finalizing Enrollment...' : 'Enroll Router Node'}
             </button>
          </div>
        )}

        <div className="mt-auto p-6 border-t border-white/5 flex justify-between items-center bg-white/5/30">
          <button 
            type="button" 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/network/routers')}
            className="text-textSecondary text-[12px] px-2 hover:text-textSecondary transition font-normal"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 && (
            <div className="flex flex-col items-end gap-2">
              {apiError && step === 1 && (
                <span className="text-[11px] text-rose-500 font-normal mr-2">
                  {!routerName ? 'Site Name is required' : 
                   !tunnelIp ? 'Tunnel IP is required' :
                   !authUser ? 'Admin Username is required' :
                   !authPass ? 'Admin Password is required' : 
                   !radiusSecret ? 'RADIUS Secret is required' : 'Please check all fields'}
                </span>
              )}
              <button 
                onClick={() => {
                  if (step === 1 && (!routerName || !authUser || !authPass || !tunnelIp || !radiusSecret)) {
                      setApiError('VALIDATION_ERROR');
                      return;
                  }
                  setApiError('');
                  setStep(step + 1);
                }} 
                className="bg-bgPrimary text-white px-8 py-2.5 rounded-xl text-[12px] font-normal shadow-sm hover:bg-black transition-all flex items-center"
              >
                Next Step <IconArrowRight className="w-3.5 h-3.5 ml-2" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
