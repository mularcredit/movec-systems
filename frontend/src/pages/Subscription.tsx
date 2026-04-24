import React, { useState } from 'react';
import {
  CheckCircle2, Zap, Shield, Star, Server, Users,
  BarChart2, Clock, ChevronRight, Crown, ArrowUpRight,
  Wifi, HelpCircle, Mail
} from 'lucide-react';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 400,
    routers: 1,
    color: 'slate',
    recommended: false,
    features: [
      'Up to 1 MikroTik router',
      'Unlimited customers',
      'Analytics & Reports',
      'Email Support',
    ],
  },
  {
    id: 'standard',
    name: 'Standard Plan',
    price: 1500,
    routers: 20,
    color: 'emerald',
    recommended: true,
    features: [
      'Up to 20 MikroTik routers',
      'Unlimited customers',
      'Analytics & Reports',
      'Email Support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Plan',
    price: 2000,
    routers: 50,
    color: 'violet',
    recommended: false,
    features: [
      'Up to 50 MikroTik routers',
      'Unlimited customers',
      'Analytics & Reports',
      'Priority Support',
      'Custom Features',
    ],
  },
];

// Simulated current subscription state
const CURRENT = {
  plan: 'basic',
  planName: 'Basic Plan',
  price: 400,
  routerLimit: 1,
  status: 'active',
  startDate: new Date('2026-04-15'),
  endDate: new Date('2026-05-15'),
  routersUsed: 0,
  customersCount: 0,
};

function daysRemaining(endDate: Date) {
  const diff = endDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Subscription() {
  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const days = daysRemaining(CURRENT.endDate);
  const usagePercent = (CURRENT.routersUsed / CURRENT.routerLimit) * 100;

  const handleUpgrade = (planId: string) => {
    if (planId === CURRENT.plan) return;
    setUpgradeTarget(planId);
    setConfirming(true);
  };

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Page Header */}
      <div>
        <h2 className="text-[20px] font-medium text-slate-800">Platform Subscription</h2>
        <p className="text-[13px] text-slate-500 mt-1">Manage your ISP platform plan, usage limits, and billing cycle.</p>
      </div>

      {/* Current Plan Card */}
      <div className="card p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-[#0a0f1d] via-[#0d1a35] to-[#0a1628] px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Crown className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-medium text-[16px]">{CURRENT.planName}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                  {CURRENT.status}
                </span>
              </div>
              <p className="text-slate-400 text-[13px]">KES {CURRENT.price.toLocaleString()}/month · Up to {CURRENT.routerLimit} router(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Subscription Period</p>
              <p className="text-[13px] text-slate-200 font-medium">{formatDate(CURRENT.startDate)} — {formatDate(CURRENT.endDate)}</p>
            </div>
            <div className="w-px h-10 bg-white/10"></div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400 uppercase tracking-wide mb-0.5">Remaining</p>
              <p className={`text-[16px] font-medium ${days <= 7 ? 'text-amber-400' : 'text-emerald-400'}`}>{days} days</p>
            </div>
          </div>
        </div>

        {/* Usage Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/60">
          {/* Router Usage */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" />
                <span className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">Router Usage</span>
              </div>
              <span className="text-[12px] font-medium text-slate-700">{CURRENT.routersUsed}/{CURRENT.routerLimit}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
              <div
                className={`h-1.5 rounded-full transition-all ${usagePercent >= 90 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              {usagePercent === 0 ? 'No routers linked yet' : `${usagePercent.toFixed(0)}% capacity used`}
            </p>
          </div>

          {/* Customers */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">Customers</span>
            </div>
            <p className="text-[28px] font-medium text-slate-800 leading-none">{CURRENT.customersCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">Unlimited on all plans</p>
          </div>

          {/* Plan Limit */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="w-4 h-4 text-slate-400" />
              <span className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">Plan Limit</span>
            </div>
            <p className="text-[28px] font-medium text-slate-800 leading-none">{CURRENT.routerLimit}</p>
            <p className="text-[11px] text-slate-400 mt-1">MikroTik router{CURRENT.routerLimit > 1 ? 's' : ''} allowed</p>
          </div>
        </div>
      </div>

      {/* Upgrade Confirmation Modal */}
      {confirming && upgradeTarget && (() => {
        const target = PLANS.find(p => p.id === upgradeTarget)!;
        return (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-5">
                <ArrowUpRight className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-[18px] font-medium text-slate-800 mb-2">Upgrade to {target.name}?</h3>
              <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
                You will be billed <strong className="text-slate-800">KES {target.price.toLocaleString()}/month</strong> starting your next billing cycle. Your current plan features continue until {formatDate(CURRENT.endDate)}.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} className="flex-1 btn-secondary text-[13px]">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirming(false);
                    alert(`Upgrade to ${target.name} initiated. In production this would trigger a payment flow.`);
                  }}
                  className="flex-1 btn-primary text-[13px]"
                >
                  Confirm Upgrade
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Plans Grid */}
      <div>
        <h3 className="text-[15px] font-medium text-slate-800 mb-5">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const isCurrent = plan.id === CURRENT.plan;
            const isRecommended = plan.recommended;
            return (
              <div
                key={plan.id}
                className={`card flex flex-col relative overflow-hidden transition-all duration-200 ${
                  isRecommended
                    ? 'border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.3),0_8px_24px_rgba(16,185,129,0.08)]'
                    : 'hover:shadow-[0_8px_24px_rgb(0,0,0,0.06)]'
                } ${isCurrent ? 'bg-slate-50/50' : 'bg-white'}`}
              >
                {isRecommended && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-emerald-500 text-white text-[10px] font-medium px-3 py-1 rounded-bl-lg tracking-wide uppercase">
                      Recommended
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    {plan.id === 'basic' && <Zap className="w-4 h-4 text-slate-400" />}
                    {plan.id === 'standard' && <Star className="w-4 h-4 text-emerald-500" />}
                    {plan.id === 'premium' && <Crown className="w-4 h-4 text-violet-500" />}
                    <span className={`text-[13px] font-medium ${
                      plan.id === 'premium' ? 'text-violet-600' :
                      plan.id === 'standard' ? 'text-emerald-600' : 'text-slate-600'
                    }`}>{plan.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-[11px] text-slate-500 font-medium">KES</span>
                    <span className="text-[32px] font-medium text-slate-800 leading-none">{plan.price.toLocaleString()}</span>
                    <span className="text-[13px] text-slate-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${
                        plan.id === 'premium' ? 'text-violet-500' :
                        plan.id === 'standard' ? 'text-emerald-500' : 'text-slate-400'
                      }`} />
                      <span className="text-[13px] text-slate-600">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : plan.id === 'premium'
                        ? 'bg-violet-500 hover:bg-violet-600 text-white shadow-sm hover:shadow-[0_4px_12px_rgba(139,92,246,0.3)]'
                        : 'btn-primary'
                  }`}
                >
                  {isCurrent ? (
                    <><CheckCircle2 className="w-4 h-4" /> Current Plan</>
                  ) : (
                    <>Upgrade <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help footer */}
      <div className="flex items-center gap-4 p-5 bg-slate-50/50 border border-slate-200/60 rounded-xl">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <HelpCircle className="w-5 h-5 text-slate-400" />
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-medium text-slate-700">Need a custom enterprise plan?</p>
          <p className="text-[12px] text-slate-500 mt-0.5">Contact us for plans with more than 50 routers, white-labeling, or on-premise deployment.</p>
        </div>
        <a href="mailto:support@enterprise.edge" className="btn-secondary flex items-center gap-2 text-[13px] shrink-0">
          <Mail className="w-4 h-4" /> Contact Sales
        </a>
      </div>
    </div>
  );
}
