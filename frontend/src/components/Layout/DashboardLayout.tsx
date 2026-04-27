import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IconActivity, IconBell, IconBookmark, IconBox, IconChartBar, IconChevronDown, IconChevronRight, IconClock, IconCpu, IconCreditCard, IconHelpCircle, IconLayoutDashboard, IconLogout, IconMenu2, IconMessage, IconRouter, IconServer, IconSettings, IconShare, IconShield, IconTerminal2, IconUser, IconUserCheck, IconUsers, IconWifi, IconX } from '@tabler/icons-react';;
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';

export default function DashboardLayout() {
  const [networkOpen, setNetworkOpen]   = useState(true);
  const [profileOpen, setProfileOpen]   = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [userData, setUserData]         = useState<{ name: string; email: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({
          name: user.user_metadata?.full_name || 'System User',
          email: user.email || ''
        });
      }
    };
    getUser();

    // Close dropdown on click outside
    const close = () => {
      setProfileOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // Close sidebar on route change (for mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navGroups = [
    { label: 'Dashboard',        path: '/',                icon: IconLayoutDashboard },
    { label: 'Active Users',     path: '/customers/active', icon: IconUserCheck },
    { label: 'All Users',        path: '/customers/all',   icon: IconUsers },
    { label: 'Packages',         path: '/packages',        icon: IconBox },
    { label: 'Communication',    path: '/communication',   icon: IconMessage },
    { label: 'Payments',         path: '/payments',        icon: IconCreditCard },
    { label: 'Payment Monitor',  path: '/payment-monitor', icon: IconActivity },
    { label: 'Statistics',       path: '/statistics',      icon: IconChartBar },
  ];

  const networkSubmenu = [
    { label: 'Routers', path: '/network/routers', icon: IconServer },
    { label: 'Hotspot Server', path: '/network/hotspot', icon: IconWifi },
    { label: 'PPPoE Server', path: '/network/pppoe', icon: IconShare },
    { label: 'Scripts & Schedulers', path: '/network/scripts', icon: IconTerminal2 },
    { label: 'Firewall', path: '/network/firewall', icon: IconShield },
    { label: 'DHCP', path: '/network/dhcp', icon: IconCpu },
    { label: 'Interfaces', path: '/network/interfaces', icon: IconActivity },
    { label: 'Wireless', path: '/network/wireless', icon: IconRouter },
    { label: 'Router Stats', path: '/network/stats', icon: IconChartBar },
    { label: 'Live Subscriber Hub', path: '/network/monitor', icon: IconActivity },
  ];

  const bottomGroup = [
    { label: 'Settings', path: '/settings', icon: IconSettings },
    { label: 'Subscription', path: '/subscriptions', icon: IconBookmark },
    { label: 'Help', path: '/help', icon: IconHelpCircle },
  ];

  const Item = ({ item, isSub = false }: any) => {
    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
    
    return (
      <NavLink
        to={item.path}
        className={clsx(
          "flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group mb-0.5 relative",
          isSub ? "ml-6" : "",
          isActive 
            ? "bg-accentPrimary/20 text-accentPrimary shadow-sm" 
            : "text-[#DDD6FE]/70 hover:text-[#DDD6FE] hover:bg-white/5"
        )}
      >
        {isActive && !isSub && <div className="absolute left-[-16px] w-1 h-5 bg-emerald-500 rounded-full" />}
        <item.icon className={clsx("shrink-0", isSub ? "w-4 h-4 mr-3" : "w-4 h-4 mr-3", isActive && "text-emerald-400")} />
        {item.label}
      </NavLink>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bgPrimary font-sans">
      {/* MOBILE BACKDROP */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-bgPrimary/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 w-64 bg-bgSecondary flex flex-col z-50 lg:static lg:translate-x-0 transition-transform duration-300 border-r border-white/5",
        sidebarOpen ? "translate-x-0 shadow-2xl shadow-slate-900" : "-translate-x-full"
      )}>
        <div className="h-14 lg:h-20 flex items-center px-4 border-b border-white/5 shrink-0 justify-between lg:justify-start">
          <div className="px-3">
            <img src="/logo.png" alt="Logo" className="h-8 lg:h-10 w-auto" />
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-textSecondary hover:text-textPrimary"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col hide-scrollbar space-y-6">
          <div>
            <div className="text-[10px] font-medium text-textSecondary/80 uppercase tracking-widest px-2 mb-3">Core Operation</div>
            {navGroups.map((item) => <Item key={item.path} item={item} />)}
          </div>

          <div>
            <button 
              onClick={() => setNetworkOpen(!networkOpen)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-textSecondary hover:text-textPrimary transition group mb-2"
            >
              <div className="text-[10px] font-medium text-textSecondary/80 uppercase tracking-widest">Network Edge</div>
              {networkOpen ? <IconChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100" /> : <IconChevronRight className="w-3 h-3 opacity-50 group-hover:opacity-100" />}
            </button>
            
            {networkOpen && (
              <div className="relative before:absolute before:left-4 before:top-1 before:bottom-1 before:w-[1px] before:bg-bgSecondary/5">
                {networkSubmenu.map((item) => <Item key={item.path} item={item} isSub />)}
              </div>
            )}
          </div>
          
          <div className="mt-auto">
            <div className="text-[10px] font-medium text-textSecondary/80 uppercase tracking-widest px-2 mb-3">Platform System</div>
            {bottomGroup.map((item) => <Item key={item.path} item={item} />)}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto flex flex-col relative bg-bgPrimary">
        {/* Top Header */}
        <header className="h-14 bg-bgSecondary/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-4 lg:px-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-30 shrink-0 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-textSecondary hover:text-textPrimary transition"
            >
              <IconMenu2 className="w-5 h-5" />
            </button>
            <h2 className="text-[13px] lg:text-[14px] font-medium text-textPrimary">Platform Command</h2>
          </div>
          
          <div className="flex items-center gap-3 lg:gap-5">
            {/* Global Status */}
            <div className="hidden sm:flex px-2.5 py-1 bg-bgPrimary text-textPrimary border border-white/10 text-[11px] font-medium rounded-md items-center shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
              API Connected
            </div>

            <button className="text-textSecondary hover:text-textPrimary transition relative p-1">
              <IconBell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 border-2 border-bgSecondary rounded-full"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 lg:gap-3 hover:bg-bgPrimary p-1 lg:p-1.5 lg:pr-2 rounded-full transition-all group"
              >
                <div className="w-7 h-7 lg:w-8 h-8 rounded-full bg-accentPrimary flex items-center justify-center text-bgPrimary text-[11px] lg:text-[12px] font-medium shadow-sm transition-transform group-hover:scale-105">
                  {userData?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-[13px] font-medium text-textPrimary leading-none mb-0.5">{userData?.name}</p>
                  <p className="text-[11px] text-textSecondary leading-none truncate w-32">Movec Administrator</p>
                </div>
                <IconChevronDown className={clsx("w-3.5 h-3.5 text-textSecondary transition-transform", profileOpen && "rotate-180")} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-bgSecondary border border-white/10 rounded-xl shadow-xl shadow-bgPrimary/50 py-1.5 animate-in fade-in zoom-in-95 duration-100 z-40">
                  <div className="px-4 py-3 border-b border-white/5 mb-1">
                    <p className="text-[13px] font-medium text-textPrimary truncate">{userData?.name}</p>
                    <p className="text-[11px] text-textSecondary truncate mt-0.5">{userData?.email}</p>
                  </div>
                  
                  <button 
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center px-4 py-2 text-[13px] text-textSecondary hover:bg-bgPrimary hover:text-textPrimary transition"
                  >
                    <IconUser className="w-4 h-4 mr-3 text-textSecondary" />
                    My Profile
                  </button>
                  <button 
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    className="w-full flex items-center px-4 py-2 text-[13px] text-textSecondary hover:bg-bgPrimary hover:text-textPrimary transition"
                  >
                    <IconSettings className="w-4 h-4 mr-3 text-textSecondary" />
                    Account Settings
                  </button>
                  
                  <div className="h-px bg-bgSecondary/5 my-1"></div>
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-[13px] text-rose-500 hover:bg-rose-500/10 transition"
                  >
                    <IconLogout className="w-4 h-4 mr-3" />
                    Logout Session
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Payload */}
        <div className="p-4 lg:p-8 pb-12 flex-1 max-w-[1400px] w-full mx-auto animate-in fade-in duration-500">
           <Outlet />
        </div>
      </main>
    </div>
  );
}
