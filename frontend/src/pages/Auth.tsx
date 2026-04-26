import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'reset';

export default function AuthPage({ initialMode = 'login' }: { initialMode?: Mode }) {
  const [mode, setMode]               = useState<Mode>(initialMode);
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [name, setName]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [message, setMessage]         = useState('');

  useEffect(() => {
    document.title = 'Movec Connect | Secure Access';
  }, [mode]);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setMessage('');
  }, [initialMode]);

  const reset = () => { setError(''); setMessage(''); };

  const validatePassword = (pw: string) => {
    const hasUpper   = /[A-Z]/.test(pw);
    const hasLower   = /[a-z]/.test(pw);
    const hasNumber  = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
    const isLong     = pw.length >= 8;

    if (!isLong)     return "Password must be at least 8 characters long.";
    if (!hasUpper)    return "Password must contain at least one uppercase letter.";
    if (!hasLower)    return "Password must contain at least one lowercase letter.";
    if (!hasNumber)   return "Password must contain at least one number.";
    if (!hasSpecial)  return "Password must contain at least one special character.";
    return null;
  };

  const calculateStrength = (pw: string) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
    return score;
  };

  const strength = calculateStrength(password);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); reset();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);

    } else if (mode === 'signup') {
      // 1. Password Match Check
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }

      // 2. Strength Validation
      const strengthError = validatePassword(password);
      if (strengthError) {
        setError(strengthError);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      });
      if (error) setError(error.message);
      else setMessage('Check your email to confirm your account.');

    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });
      if (error) setError(error.message);
      else setMessage('Password reset link sent to your email.');
    }
    setLoading(false);
  };

  const titles: Record<Mode, string> = {
    login:  'Sign in to your account',
    signup: 'Create your account',
    reset:  'Reset your password',
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden">

      {/* ── LEFT — Video background (50% width) ─────────────────── */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 overflow-hidden border-r border-white/10">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="/2695085-hd_1920_1080_30fps.mp4"
        />

        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10">
          <img src="/logo.png" alt="Logo" className="h-20 w-auto brightness-0 invert opacity-90" />
        </div>

        <div className="relative z-10 space-y-5 max-w-sm">
          <h1 className="text-white text-[38px] font-medium leading-[1.1] tracking-tight">
            Grow your ISP business without the hustle.
          </h1>
          <p className="text-white/70 text-[15px] leading-relaxed">
            The complete management system for ISPs. Automate your billing, manage your routers, and grow your customer base without the daily stress.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            {['Automated Billing', 'Live Dashboards', 'Works With Mikrotik', 'SMS Alerts'].map(tag => (
              <span key={tag} className="text-[10px] text-white/50 border border-white/20 px-4 py-2 rounded-full uppercase tracking-widest font-medium">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — Auth form (50% width) ────────────────────────── */}
      <div className="w-full md:w-1/2 bg-bgSecondary flex flex-col justify-center items-center px-12 py-12 overflow-y-auto">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5 mb-10 md:hidden">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          </div>

          <div className="mb-10">
            <h2 className="text-[22px] font-medium text-textPrimary mb-2 tracking-tight">{titles[mode]}</h2>
            <p className="text-[14px] text-textSecondary leading-relaxed font-normal">
              {mode === 'login'  && 'Sign in to access your business dashboard.'}
              {mode === 'signup' && 'Register your ISP to start managing your customers.'}
              {mode === 'reset'  && 'Enter your email to reset your password.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-[11px] text-textSecondary mb-1.5 tracking-wider font-medium uppercase">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Kevin Mwendwa"
                  className="w-full rounded-xl px-4 py-3 text-[14px] font-normal transition-all outline-none"
                  style={{ background: 'rgba(30,24,52,0.8)', border: '1px solid rgba(167,139,250,0.2)', color: '#F3F0FF' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; e.target.style.boxShadow = '0 0 0 4px rgba(192,132,252,0.08)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(167,139,250,0.2)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

            <div>
              <label className="block text-[11px] text-textSecondary mb-1.5 tracking-wider font-medium uppercase">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@company.co.ke"
                className="w-full rounded-xl px-4 py-3 text-[14px] font-normal transition-all outline-none"
                style={{ background: 'rgba(30,24,52,0.8)', border: '1px solid rgba(167,139,250,0.2)', color: '#F3F0FF' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; e.target.style.boxShadow = '0 0 0 4px rgba(192,132,252,0.08)'; }}
                onBlur={e  => { e.target.style.borderColor = 'rgba(167,139,250,0.2)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] text-textSecondary tracking-wider font-medium uppercase">Password</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => { setMode('reset'); reset(); }} className="text-[11px] text-emerald-400 hover:text-emerald-300 transition font-medium">
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••"
                  className="w-full rounded-xl px-4 py-3 text-[14px] font-normal transition-all outline-none"
                  style={{ background: 'rgba(30,24,52,0.8)', border: '1px solid rgba(167,139,250,0.2)', color: '#F3F0FF' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; e.target.style.boxShadow = '0 0 0 4px rgba(192,132,252,0.08)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(167,139,250,0.2)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {/* Password Strength Meter — signup only */}
            {mode === 'signup' && password.length > 0 && (
              <div className="space-y-2 px-1">
                <div className="flex gap-1.5 px-0.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength ? strengthColors[strength - 1] : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-textSecondary font-medium uppercase tracking-[0.05em]">Password Strength</span>
                  <span className={`text-[10px] font-bold uppercase tracking-[0.05em] ${
                    strength === 1 ? 'text-rose-500' :
                    strength === 2 ? 'text-orange-500' :
                    strength === 3 ? 'text-amber-500' :
                    'text-emerald-500'
                  }`}>
                    {strengthLabels[strength - 1]}
                  </span>
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] text-textSecondary mb-1.5 tracking-wider font-medium uppercase">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••••"
                  className="w-full rounded-xl px-4 py-3 text-[14px] font-normal transition-all outline-none"
                  style={{ background: 'rgba(30,24,52,0.8)', border: '1px solid rgba(167,139,250,0.2)', color: '#F3F0FF' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(167,139,250,0.5)'; e.target.style.boxShadow = '0 0 0 4px rgba(192,132,252,0.08)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(167,139,250,0.2)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            )}

            {error && (
              <div className="py-2.5 px-4 bg-rose-500/15 border border-rose-500/20 rounded-xl text-[12px] text-rose-400 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}
            {message && (
              <div className="py-2.5 px-4 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-[12px] text-emerald-400 animate-in fade-in slide-in-from-top-1">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-xl text-[14px] font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #a78bfa 100%)' }}
            >
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Processing...
                  </span>
                : mode === 'login'  ? 'Sign In'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'
              }
            </button>
          </form>

          <div className="mt-8 text-center">
            {mode === 'login' && (
              <p className="text-[12px] text-textSecondary">
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); reset(); }} className="text-emerald-400 hover:text-emerald-300 transition font-semibold">
                  Create one
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p className="text-[12px] text-textSecondary">
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); reset(); }} className="text-emerald-400 hover:text-emerald-300 transition font-semibold">
                  Sign in
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <button onClick={() => { setMode('login'); reset(); }} className="text-[12px] text-textSecondary hover:text-textSecondary transition font-medium">
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-textSecondary md:relative md:mt-10 md:bottom-auto">
          © {new Date().getFullYear()} Movec Connect ISP Platform
        </p>
      </div>
    </div>
  );
}
