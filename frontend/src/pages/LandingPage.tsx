import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, MessageSquare, CreditCard, Network, Activity, ArrowRight, ShieldCheck, Zap, WalletCards, BellRing, Router as RouterIcon, Radar, Gauge, Fingerprint } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bgPrimary text-white font-sans selection:bg-emerald-500/30">
      
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="absolute top-0 left-0 right-0 z-50 px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Movec Connect" className="h-14 w-auto brightness-0 invert" />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="text-sm font-medium text-white/80 hover:text-white transition">
            Log In
          </button>
          <button onClick={() => navigate('/signup')} className="text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-full transition shadow-lg shadow-emerald-500/20">
            Sign Up
          </button>
        </div>
      </nav>

      {/* ── Hero Section with Video Background ───────────────────────────── */}
      <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          src="/141445-777657273.mp4"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900" />

        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl pt-20 animate-in fade-in slide-in-from-bottom-5 duration-1000">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bgSecondary/5 border border-white/10 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-8">
            <Zap className="w-3 h-3" /> Smarter ISP Management
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
            Grow your ISP business <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">without the hustle.</span>
          </h1>
          <p className="text-lg md:text-xl text-textSecondary mb-10 max-w-2xl mx-auto leading-relaxed">
            The complete management system for ISPs. Automate your billing, manage your routers, and grow your customer base without the daily stress.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => navigate('/signup')} className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-medium transition flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 text-lg">
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }} className="w-full sm:w-auto px-8 py-4 bg-bgSecondary/10 hover:bg-bgSecondary/15 text-white rounded-full font-medium transition flex items-center justify-center gap-2 backdrop-blur-md text-lg">
              Explore Platform
            </button>
          </div>
        </div>
      </div>

      {/* ── Features Section ─────────────────────────────────────────────── */}
      <div id="features" className="py-24 bg-bgPrimary relative z-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to run your ISP</h2>
            <p className="text-textSecondary max-w-2xl mx-auto text-lg">Manage your customers, payments, and network from one simple dashboard.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-bgSecondary/40 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-bgSecondary/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/10 group">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] group-hover:scale-110 transition-transform duration-300">
                <WalletCards className="w-7 h-7 text-emerald-400 drop-shadow-md" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Automated Billing</h3>
              <p className="text-textSecondary leading-relaxed text-[15px]">
                Instant M-Pesa Daraja connection. When a customer pays, the system automatically reconnects them. No manual confirmations needed.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-bgSecondary/40 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-bgSecondary/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10 group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/5 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)] group-hover:scale-110 transition-transform duration-300">
                <BellRing className="w-7 h-7 text-blue-400 drop-shadow-md" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Smart Reminders</h3>
              <p className="text-textSecondary leading-relaxed text-[15px]">
                Send billing and suspension alerts directly via SMS and WhatsApp. Keep your customers informed and collect your payments on time.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-bgSecondary/40 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-bgSecondary/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-500/10 group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-purple-600/5 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.1)] group-hover:scale-110 transition-transform duration-300">
                <RouterIcon className="w-7 h-7 text-purple-400 drop-shadow-md" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Works With Any Router</h3>
              <p className="text-textSecondary leading-relaxed text-[15px]">
                Control MikroTik directly or connect Ruijie, TP-Link, and Huawei using our built in RADIUS server. We support the hardware you already have.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-bgSecondary/40 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-bgSecondary/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/10 group">
              <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-amber-600/5 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.1)] group-hover:scale-110 transition-transform duration-300">
                <Radar className="w-7 h-7 text-amber-400 drop-shadow-md" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Live Dashboards</h3>
              <p className="text-textSecondary leading-relaxed text-[15px]">
                Monitor live PPPoE and Hotspot sessions, track data limits, and watch your interface traffic from one simple screen.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-bgSecondary/40 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-bgSecondary/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/10 group">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 rounded-2xl flex items-center justify-center mb-6 border border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.1)] group-hover:scale-110 transition-transform duration-300">
                <Gauge className="w-7 h-7 text-cyan-400 drop-shadow-md" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Traffic Control</h3>
              <p className="text-textSecondary leading-relaxed text-[15px]">
                Manage bandwidth speeds and firewall security easily. Deliver fast and reliable internet to keep your customers happy.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-bgSecondary/40 backdrop-blur-sm border border-slate-700/50 p-8 rounded-3xl hover:bg-bgSecondary/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-500/10 group">
              <div className="w-14 h-14 bg-gradient-to-br from-rose-500/20 to-rose-600/5 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20 shadow-[0_0_20px_rgba(244,63,94,0.1)] group-hover:scale-110 transition-transform duration-300">
                <Fingerprint className="w-7 h-7 text-rose-400 drop-shadow-md" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">Secure Remote Access</h3>
              <p className="text-textSecondary leading-relaxed text-[15px]">
                Connect your remote routers safely using WireGuard tunnels. Reach your devices even when they are hidden behind a NAT.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800 py-10 text-center">
        <p className="text-textSecondary text-sm">© {new Date().getFullYear()} Movec Connect. All rights reserved.</p>
      </footer>
    </div>
  );
}
