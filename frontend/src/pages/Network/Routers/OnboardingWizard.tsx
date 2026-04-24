import React, { useState } from 'react';
import { 
  Server, Shield, Wifi, Key, Activity, ArrowRight,
  CheckCircle2, TerminalSquare, Info, ShieldAlert,
  Copy, RefreshCw, AlertTriangle, Radio, Cpu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../lib/apiClient';

const Confetti = () => {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50 rounded-xl">
      <style>{`
        @keyframes confettiDrop {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          animation: confettiDrop cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>
      {[...Array(60)].map((_, i) => (
        <div
          key={i}
          className="absolute top-[-5%] confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 8 + 4}px`,
            height: `${Math.random() * 12 + 6}px`,
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            animationDelay: `${Math.random() * 1.5}s`,
            animationDuration: `${Math.random() * 2 + 1.5}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
};

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Vendor selection
  const [vendor, setVendor] = useState<'mikrotik' | 'radius'>('mikrotik');

  // MikroTik-specific
  const [connType, setConnType] = useState('wireguard');
  const [tikPublicKey, setTikPublicKey] = useState('');
  const [directIp, setDirectIp] = useState('');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Shared credentials
  const [routerName, setRouterName] = useState('');
  const [apiPort, setApiPort] = useState('8728');
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');

  // RADIUS-specific
  const [nasIp, setNasIp] = useState('');
  const [radiusSecret, setRadiusSecret] = useState('');

  // State
  const [isHandshaking, setIsHandshaking] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const getTargetIp = () => connType === 'wireguard' ? '10.9.35.31' : directIp;

  // ── MikroTik: Live Handshake ───────────────────────────────────────────────
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
      if (!resp.ok || !data.success) {
        throw new Error(`${data.error || 'Connection failed.'}${data.details ? ` (${data.details})` : ''}`);
      }
      setStep(6);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsHandshaking(false);
    }
  };

  // ── Deploy: Save router to DB ──────────────────────────────────────────────
  const handleDeploy = async () => {
    setIsDeploying(true);
    setApiError('');
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
        // RADIUS mode
        body.ip = nasIp;
        body.port = 1812;
        body.vendor_config = {
          nas_ip: nasIp,
          radius_secret: radiusSecret
        };
      }

      const resp = await apiFetch('/api/router/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to save router to DB');
      }
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

  // ── Step labels differ by vendor ──────────────────────────────────────────
  const mikrotikSteps = [
    { num: 1, title: "Vendor" },
    { num: 2, title: "Prerequisites" },
    { num: 3, title: "Configuration" },
    { num: 4, title: "Credentials" },
    { num: 5, title: "Validation" },
    { num: 6, title: "Deploy" }
  ];
  const radiusSteps = [
    { num: 1, title: "Vendor" },
    { num: 2, title: "NAS Config" },
    { num: 3, title: "Identity" },
    { num: 4, title: "Deploy" }
  ];
  const steps = vendor === 'radius' ? radiusSteps : mikrotikSteps;
  const totalSteps = steps.length;

  return (
    <div className="max-w-4xl mx-auto py-8">
      
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-medium text-slate-800 tracking-tight">Add New Router Node</h2>
        <p className="text-slate-500 mt-2">Link a network gateway to the Movec Connect platform</p>
      </div>

      {/* Progress Tracker */}
      <div className="flex justify-center mb-10 overflow-x-auto pb-4">
         <div className="flex items-center gap-2 whitespace-nowrap">
            {steps.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className={`flex items-center text-[13px] font-medium transition-colors duration-300 ${step === s.num ? 'text-emerald-600' : step > s.num ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step > s.num ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-500" /> : <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-1.5 ${step === s.num ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>{s.num}</span>}
                  {s.title}
                </div>
                {i < totalSteps - 1 && <div className={`w-6 h-px ${step > s.num ? 'bg-slate-300' : 'bg-slate-200'}`}></div>}
              </React.Fragment>
            ))}
         </div>
      </div>

      <div className="card shadow-2xl border-slate-200/60 min-h-[500px] flex flex-col justify-between bg-white overflow-hidden">

        {/* ── STEP 1: VENDOR SELECTION (All vendors) ────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6 p-8 animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-medium text-slate-800">Select Hardware Vendor</h3>
              <p className="text-[13px] text-slate-500 mt-1">Choose how this router integrates with the billing platform.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MikroTik Card */}
              <label
                className={`cursor-pointer rounded-xl border p-6 transition-all w-full flex flex-col items-start bg-white ${vendor === 'mikrotik' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setVendor('mikrotik')}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vendor === 'mikrotik' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    <Cpu className={`w-5 h-5 ${vendor === 'mikrotik' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  {vendor === 'mikrotik' && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />}
                </div>
                <h4 className="font-semibold text-[15px] text-slate-800">MikroTik RouterOS</h4>
                <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                  Direct socket API control. Full PPPoE, session control, queue management. Real-time provisioning.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['PPPoE', 'Hotspot', 'Queue Trees', 'Firewall'].map(t => (
                    <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{t}</span>
                  ))}
                </div>
              </label>

              {/* RADIUS / Generic Card */}
              <label
                className={`cursor-pointer rounded-xl border p-6 transition-all w-full flex flex-col items-start bg-white ${vendor === 'radius' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setVendor('radius')}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vendor === 'radius' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                    <Radio className={`w-5 h-5 ${vendor === 'radius' ? 'text-blue-600' : 'text-slate-400'}`} />
                  </div>
                  {vendor === 'radius' && <CheckCircle2 className="w-5 h-5 text-blue-500 ml-auto" />}
                </div>
                <h4 className="font-semibold text-[15px] text-slate-800">RADIUS / Generic NAS</h4>
                <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                  Vendor-agnostic. Works with Ruijie, Huawei, TP-Link, and any device that supports RADIUS (RFC 2865).
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Ruijie', 'Huawei', 'TP-Link', 'Any NAS'].map(t => (
                    <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium border border-blue-100">{t}</span>
                  ))}
                </div>
              </label>
            </div>

            <div className={`flex items-start gap-3 p-4 rounded-xl border text-[12px] leading-relaxed ${vendor === 'mikrotik' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              {vendor === 'mikrotik'
                ? <span><strong>MikroTik Mode:</strong> Requires RouterOS API-SSL enabled on port 8729 and a dedicated API user. We'll verify the handshake before saving.</span>
                : <span><strong>RADIUS Mode:</strong> Configure your device to point its authentication server to <code className="bg-blue-100 px-1 rounded font-mono">213.188.220.233:1812</code> (UDP). No direct connection to this device is required — it authenticates against us.</span>
              }
            </div>
          </div>
        )}

        {/* ── MIKROTIK: STEP 2 — Prerequisites ──────────────────────────────── */}
        {vendor === 'mikrotik' && step === 2 && (
          <div className="space-y-6 p-8 animate-in fade-in duration-300">
             <div className="flex items-start text-amber-600 mb-6 bg-amber-50 p-5 rounded-xl border border-amber-100">
               <ShieldAlert className="w-6 h-6 mr-4 shrink-0 mt-1" />
               <div>
                  <h3 className="font-semibold text-[15px]">Before You Begin</h3>
                  <p className="text-[13px] text-amber-800/80 mt-1 leading-relaxed">
                    Ensure your MikroTik is running v7.x+. We recommend a factory reset (`System {"->"} Reset Configuration`) before starting this process.
                  </p>
               </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-medium text-[14px]">
                  <ShieldAlert className="w-4 h-4 text-slate-400" />
                  Step 2.1: Enable API-SSL (Secure Transport) & Restrict Access
                </div>
                <div className="relative group">
                  <pre className="bg-slate-900 p-4 rounded-xl font-mono text-[12px] text-emerald-400 overflow-x-auto shadow-inner">
                    /ip service enable api-ssl{'\n'}
                    /ip service disable api{'\n'}
                    /ip service set api-ssl address=YOUR_BACKEND_IP/32
                  </pre>
                  <button 
                    onClick={() => copyToClipboard('/ip service enable api-ssl\n/ip service disable api\n/ip service set api-ssl address=YOUR_BACKEND_IP/32', 'ssl')}
                    className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 transition"
                  >
                    {copyStatus === 'ssl' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800">Critical:</span> We enforce <span className="font-mono bg-slate-200 px-1 py-0.5 rounded text-rose-600">api-ssl</span> (Port 8729). Plaintext API (Port 8728) risks credential exposure. Replace YOUR_BACKEND_IP with this billing server's exact public IP.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-slate-800 font-medium text-[14px] mt-6">
                  <Key className="w-4 h-4 text-slate-400" />
                  Step 2.2: Least Privilege Remote Auth User
                </div>
                <div className="relative group">
                  <pre className="bg-slate-900 p-4 rounded-xl font-mono text-[12px] text-emerald-400 overflow-x-auto shadow-inner">
                    /user group add name=movec policy=read,write,api,!ftp,!winbox,!ssh,!telnet{'\n'}
                    /user add name=movec-api group=movec password=YOUR_STRONG_PASSWORD
                  </pre>
                  <button 
                    onClick={() => copyToClipboard('/user group add name=movec policy=read,write,api,!ftp,!winbox,!ssh,!telnet\n/user add name=movec-api group=movec password=YOUR_STRONG_PASSWORD', 'user')}
                    className="absolute top-3 right-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 transition"
                  >
                    {copyStatus === 'user' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-start gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-blue-800 leading-relaxed">
                    <span className="font-bold">Why?</span> Granting "Full" access is unsafe. The command scopes a `movec` group limited strictly to API reads/writes, explicitly prohibiting UI/SSH remote infiltration.
                  </p>
                </div>
             </div>
          </div>
        )}

        {/* ── MIKROTIK: STEP 3 — Connection Type ────────────────────────────── */}
        {vendor === 'mikrotik' && step === 3 && (
          <div className="p-8 space-y-8 animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-medium text-slate-800">Architecture & Tunneling</h3>
              <p className="text-[13px] text-slate-500 mt-1">Select how Movec Connect will reach your router node.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`cursor-pointer rounded-xl border p-5 transition-all w-full flex flex-col items-start bg-white ${connType === 'direct' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" value="direct" checked={connType === 'direct'} onChange={(e) => setConnType(e.target.value)} className="sr-only" />
                <Wifi className={`w-5 h-5 mb-3 ${connType === 'direct' ? 'text-emerald-500' : 'text-slate-400'}`} />
                <h4 className="font-medium text-[14px] text-slate-800">Direct Connection</h4>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">System connects to a public IP endpoint. Requires open API port (8728/8729).</p>
              </label>

              <label className={`cursor-pointer rounded-xl border p-5 transition-all w-full flex flex-col items-start bg-white ${connType === 'wireguard' ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" value="wireguard" checked={connType === 'wireguard'} onChange={(e) => setConnType(e.target.value)} className="sr-only" />
                <Shield className={`w-5 h-5 mb-3 ${connType === 'wireguard' ? 'text-emerald-500' : 'text-slate-400'}`} />
                <h4 className="font-medium text-[14px] text-slate-800">Movec VPN (WireGuard)</h4>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">Recommended. Connects over a secure 256-bit encrypted tunnel even behind NAT/CGNAT.</p>
              </label>
            </div>

            {connType === 'direct' && (
              <div className="space-y-3 pt-2 animate-in fade-in">
                <label className="block text-[12px] font-medium text-slate-700">Router Public IP Address</label>
                <p className="text-[11px] text-slate-400">The external IPv4 address reachable over the internet.</p>
                <input 
                  type="text" value={directIp} onChange={(e) => setDirectIp(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 border-slate-200 !py-3 font-mono shadow-inner max-w-md" 
                  placeholder="e.g. 197.80.3.11" 
                />
              </div>
            )}

            {connType === 'wireguard' && (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-950 border-b border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">MikroTik CLI Instructions</span>
                  </div>
                  <div className="p-5 font-mono text-[12px] text-emerald-400 space-y-4 max-h-[300px] overflow-y-auto thin-scrollbar">
                    <div>
                      <span className="text-slate-500"># 1. Create WireGuard Interface</span>
                      <pre className="mt-1">/interface wireguard add name=wg-billing listen-port=0 mtu=1420</pre>
                    </div>
                    <div>
                      <span className="text-slate-500"># 2. Add Movec Connect as Peer</span>
                      <pre className="mt-1 whitespace-pre-wrap">/interface wireguard peers add interface=wg-billing public-key="tnkl362ob+lNRDj8BAVX+2Fzo6NpuphQ93w/lLC4Mgs=" endpoint-address=212.95.34.147 endpoint-port=1198 allowed-address=0.0.0.0/0 persistent-keepalive=25</pre>
                    </div>
                    <div>
                      <span className="text-slate-500"># 3. Assign Tunnel IP</span>
                      <pre className="mt-1">/ip address add address=10.9.35.31/16 interface=wg-billing</pre>
                    </div>
                    <div>
                      <span className="text-slate-500"># 4. Allow API over Tunnel & Lockdown</span>
                      <pre className="mt-1 whitespace-pre-wrap">/ip firewall filter remove [find dynamic=no]&#10;/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=10.9.0.1 action=accept comment="Allow API from VPS"&#10;/ip service enable api</pre>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[12px] font-medium text-slate-700">Step 3.1: Paste YOUR MikroTik Public Key</label>
                  <p className="text-[11px] text-slate-400">Get this with: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">/interface wireguard get wg-billing public-key</code></p>
                  <input 
                    type="text" value={tikPublicKey} onChange={(e) => setTikPublicKey(e.target.value)}
                    className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 border-slate-200 !py-3 font-mono shadow-inner" 
                    placeholder="Enter 44-character public key..." 
                  />
                  {tikPublicKey.length > 0 && tikPublicKey.length !== 44 && (
                    <p className="text-[10px] text-rose-500 font-medium">Standard keys are exactly 44 characters.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MIKROTIK: STEP 4 — Credentials ────────────────────────────────── */}
        {vendor === 'mikrotik' && step === 4 && (
          <div className="p-8 space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-slate-800">Router Identity & Credentials</h3>
                <p className="text-[13px] text-slate-500 mt-1">Define how this node appears in the Movec Connect dashboard.</p>
              </div>
              <span className="badge-warning !bg-slate-100 !text-slate-600 !border-slate-200"><Shield className="w-3 h-3 mr-1"/> AES-256 GCM Encrypted</span>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">Router Name</label>
                <input type="text" value={routerName} onChange={(e) => setRouterName(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3" placeholder="e.g. Main Office Gateway" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">API Port (SSL: 8729)</label>
                <input type="text" value={apiPort} onChange={(e) => setApiPort(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3 font-mono" placeholder="8729" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">Auth Username</label>
                <input type="text" value={authUser} onChange={(e) => setAuthUser(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3" placeholder="e.g. movec-api" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">Auth Password</label>
                <input type="password" value={authPass} onChange={(e) => setAuthPass(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3" placeholder="••••••••" />
              </div>
            </div>
          </div>
        )}

        {/* ── MIKROTIK: STEP 5 — Test Connection ────────────────────────────── */}
        {vendor === 'mikrotik' && step === 5 && (
          <div className="p-8 flex flex-col items-center justify-center py-10 animate-in fade-in duration-300 text-center">
            <div className="relative">
               <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
               <Server className="w-20 h-20 text-emerald-500 relative" />
            </div>
            
            <h3 className="text-2xl font-medium text-slate-800 mt-8 mb-3">Initiating Probe</h3>
            <p className="text-slate-500 text-center max-w-sm mb-8 leading-relaxed text-[14px]">
              Ready to negotiate an API handshake with the target node. This validates credentials before deployment.
            </p>
            
            <div className="w-full max-w-xs bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8 font-mono text-[11px] text-slate-600 space-y-2 text-left mx-auto shadow-inner">
               <div className="flex justify-between"><span>Target:</span> <span className="font-medium text-slate-800">{getTargetIp() || '<Public IP>'}</span></div>
               <div className="flex justify-between"><span>User:</span> <span className="font-medium text-slate-800">{authUser || 'admin'}</span></div>
               <div className="flex justify-between"><span>Port:</span> <span className="font-medium text-slate-800">{apiPort || '8729'}</span></div>
               <div className="flex justify-between"><span>Transport:</span> <span className="font-medium text-emerald-600 font-bold">{connType.toUpperCase()}</span></div>
            </div>

            {apiError && (
              <div className="flex items-start gap-3 bg-rose-50 p-4 rounded-xl border border-rose-200 mb-6 text-left max-w-md">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-rose-800 leading-relaxed font-medium">Handshake Failed: <span className="font-normal block mt-1">{apiError}</span></p>
              </div>
            )}

            <button 
              onClick={executeHandshake} disabled={isHandshaking}
              className="auth-btn !w-auto !px-[3.5rem] py-3.5 flex items-center justify-center group shadow-xl transition-all"
            >
              {isHandshaking ? (<><RefreshCw className="w-5 h-5 mr-3 animate-spin" /> Negotiating...</>) 
                             : (<><Activity className="w-5 h-5 mr-3 group-hover:animate-bounce" /> Execute Handshake</>)}
            </button>
          </div>
        )}

        {/* ── RADIUS: STEP 2 — NAS configuration instructions ──────────────── */}
        {vendor === 'radius' && step === 2 && (
          <div className="space-y-6 p-8 animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-medium text-slate-800">Configure Your Device (NAS)</h3>
              <p className="text-[13px] text-slate-500 mt-1">
                Point your device's RADIUS authentication to this server. This is a one-time setup on the device's web UI or CLI.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-[13px] text-blue-800 space-y-1">
                  <p className="font-semibold">What to configure on your router/gateway:</p>
                  <ul className="list-disc list-inside space-y-1 text-[12px] leading-relaxed">
                    <li>RADIUS Authentication Server IP → <code className="bg-blue-100 px-1 rounded font-mono">213.188.220.233</code></li>
                    <li>Authentication Port → <code className="bg-blue-100 px-1 rounded font-mono">1812</code></li>
                    <li>RADIUS Shared Secret → <em>You'll create this on the next screen</em></li>
                    <li>Authentication Protocol → <code className="bg-blue-100 px-1 rounded font-mono">PAP</code></li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold text-slate-700 mb-3">Quick Reference by Vendor:</p>
              <div className="space-y-3">
                {[
                  { brand: 'Ruijie / Reyee', path: 'Authentication → Authentication Server → RADIUS', color: 'orange' },
                  { brand: 'Huawei', path: 'AAA → RADIUS Server → New', color: 'red' },
                  { brand: 'TP-Link / Omada', path: 'Settings → Authentication → RADIUS Server', color: 'blue' },
                  { brand: 'Generic / OpenWRT', path: '/etc/config/freeradius or LuCI → RADIUS Client', color: 'slate' }
                ].map(v => (
                  <div key={v.brand} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 w-32 shrink-0">{v.brand}</span>
                    <span className="text-[11px] text-slate-500 font-mono leading-relaxed">{v.path}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-800">
                <strong>Important:</strong> The backend IP is <strong className="font-mono">213.188.220.233</strong>. Configure your NAS to send RADIUS requests to this IP on <strong>UDP port 1812</strong>. Ensure no local firewall on the NAS blocks outbound UDP:1812.
              </p>
            </div>
          </div>
        )}

        {/* ── RADIUS: STEP 3 — Identity & Secret ────────────────────────────── */}
        {vendor === 'radius' && step === 3 && (
          <div className="p-8 space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-slate-800">Router Identity & RADIUS Secret</h3>
                <p className="text-[13px] text-slate-500 mt-1">Name this node and set the shared secret that the NAS will use to authenticate against our server.</p>
              </div>
              <span className="badge-warning !bg-blue-50 !text-blue-600 !border-blue-200">
                <Radio className="w-3 h-3 mr-1"/> RADIUS Mode
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">Router / Site Name</label>
                <input type="text" value={routerName} onChange={(e) => setRouterName(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3" placeholder="e.g. Ruijie EG — Westlands Branch" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">Device IP Address (NAS IP)</label>
                <input type="text" value={nasIp} onChange={(e) => setNasIp(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3 font-mono" placeholder="e.g. 192.168.1.1" />
                <p className="text-[11px] text-slate-400 mt-1">The IP address of the physical router/gateway device.</p>
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-medium text-slate-600 mb-1.5 tracking-wide">RADIUS Shared Secret</label>
                <input type="text" value={radiusSecret} onChange={(e) => setRadiusSecret(e.target.value)}
                  className="auth-input !rounded-xl !bg-slate-50 !text-slate-800 !py-3 font-mono" 
                  placeholder="e.g. movec-reyee-branch1-2024" />
                <p className="text-[11px] text-slate-400 mt-1">
                  This exact string must be entered on your device's RADIUS client config. Use at least 16 characters.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[12px] text-slate-600">
                The shared secret is stored encrypted in our database and used only to validate incoming RADIUS packets from this specific NAS device. It is never transmitted in plaintext.
              </p>
            </div>
          </div>
        )}

        {/* ── DEPLOY: Final step (both vendor paths converge here) ──────────── */}
        {((vendor === 'mikrotik' && step === 6) || (vendor === 'radius' && step === 4)) && (
           <div className="relative p-8 flex flex-col items-center justify-center py-12 animate-in fade-in scale-in duration-300 text-center">
             <Confetti />
             
             <div className="relative mb-10">
               <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-2xl animate-pulse"></div>
               <div className="w-36 h-36 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 shadow-inner relative z-10 animate-bounce">
                 <CheckCircle2 className="w-20 h-20 text-emerald-500" />
               </div>
             </div>
             
             <div className={`border px-4 py-1.5 rounded-full text-[13px] font-bold tracking-wide uppercase mb-6 flex items-center gap-2 ${vendor === 'mikrotik' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
               {vendor === 'mikrotik' ? <Shield className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
               {vendor === 'mikrotik' ? 'Handshake Successful' : 'Configuration Ready'}
             </div>

             <h3 className="text-4xl font-medium text-slate-800 mb-3 tracking-tight">Ready to Deploy</h3>
             <p className="text-slate-500 text-center max-w-sm mb-10 text-[15px] leading-relaxed">
               {vendor === 'mikrotik'
                 ? 'Authentication verified! Proceed to actively enroll this router into the Movec Connect network dashboard.'
                 : `Enroll this RADIUS NAS into the platform. Ensure your ${routerName || 'device'} is pointed to this server's IP on UDP 1812.`
               }
             </p>

             {apiError && (
              <div className="flex items-start gap-3 bg-rose-50 p-4 rounded-xl border border-rose-200 mb-6 text-left max-w-md mx-auto">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-rose-800 leading-relaxed font-medium">Deployment Failed: <span className="font-normal block mt-1">{apiError}</span></p>
              </div>
             )}

             <button 
               onClick={handleDeploy} disabled={isDeploying}
               className="auth-btn !bg-emerald-600 !hover:bg-emerald-700 !w-auto !px-16 py-4 shadow-xl"
             >
               {isDeploying ? 'Linking...' : 'Link Router Now'}
             </button>
           </div>
        )}


        {/* Navigation Footer */}
        <div className="mt-auto p-8 pt-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
          <button 
            type="button" 
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/network/routers')}
            className={((vendor === 'mikrotik' && step === 6) || (vendor === 'radius' && step === 4)) ? "hidden" : "text-slate-500 text-[13px] font-medium px-4 hover:text-slate-800 transition"}
          >
            {step === 1 ? 'Cancel Onboarding' : 'Previous Step'}
          </button>
          
          {/* MikroTik nav — steps 1-4 */}
          {vendor === 'mikrotik' && step < 5 && (
            <button 
              disabled={
                (step === 3 && connType === 'wireguard' && tikPublicKey.length < 32) ||
                (step === 3 && connType === 'direct' && directIp.length < 7) ||
                (step === 4 && (!routerName || !authUser || !authPass))
              }
              onClick={() => setStep(step + 1)} 
              className="auth-btn !w-auto !px-10 py-3 flex items-center shadow-lg disabled:grayscale"
            >
              {step === 1 ? 'Select & Continue' : 'Next Step'} <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
          {/* MikroTik: Force override on handshake step */}
          {vendor === 'mikrotik' && step === 5 && (
             <button onClick={() => setStep(6)} className="text-slate-400 font-medium text-[11px] underline hover:text-slate-600 transition">
               Force Override (skip handshake)
             </button>
          )}

          {/* RADIUS nav — steps 1-3 */}
          {vendor === 'radius' && step < 4 && (
            <button 
              disabled={
                step === 3 && (!routerName || !nasIp || radiusSecret.length < 8)
              }
              onClick={() => setStep(step + 1)} 
              className="auth-btn !w-auto !px-10 py-3 flex items-center shadow-lg disabled:grayscale"
            >
              {step === 1 ? 'Select & Continue' : 'Next Step'} <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
