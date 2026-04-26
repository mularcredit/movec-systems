import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import DashboardLayout from './components/Layout/DashboardLayout';
import AuthPage from './pages/Auth';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ActiveUsers from './pages/Customers/ActiveUsers';
import AllUsers from './pages/Customers/AllUsers';
import AddCustomer from './pages/Customers/AddCustomer';
import CustomerProfile from './pages/Customers/CustomerProfile';
import EditCustomer from './pages/Customers/EditCustomer';
import Packages from './pages/Packages';
import Payments from './pages/Payments';
import Statistics from './pages/Statistics/Statistics';
import Settings from './pages/Settings';
import AddPackage from './pages/Packages/AddPackage';
import EditPackage from './pages/Packages/EditPackage';
import Subscription from './pages/Subscription';
import Communication from './pages/Communication/Communication';
import PaymentMonitor from './pages/PaymentMonitor/PaymentMonitor';
import { LayoutTemplate, Loader2, Server } from 'lucide-react';

// Network
import RoutersList from './pages/Network/Routers/RoutersList';
import RouterWizard from './pages/Network/Routers/OnboardingWizard';
import RouterDetail from './pages/Network/Routers/RouterDetail';
import EditRouter from './pages/Network/Routers/EditRouter';
import NetworkModuleRedirect from './pages/Network/NetworkModuleRedirect';
import LiveSessions from './pages/Network/LiveSessions';
import RouterStats from './pages/Network/RouterStats/RouterStats';

import { apiFetch } from './lib/apiClient';
import CustomLoader from './components/common/CustomLoader';

// Minimal Placeholder UI
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col h-full min-h-[400px] items-center justify-center p-10 text-center animate-in fade-in">
    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
       <LayoutTemplate className="w-8 h-8 text-textSecondary" />
    </div>
    <h2 className="text-[16px] font-medium text-textPrimary mb-2">{title} Module</h2>
    <p className="text-[13px] text-textSecondary max-w-sm">This interface component is currently pending live interop integration.</p>
  </div>
);

// Router Dependency Guard
const RequireRouter = ({ children }: { children: React.ReactNode }) => {
  const [hasRouter, setHasRouter] = useState<boolean | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    apiFetch('/api/router')
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error('API format mismatch');
        setHasRouter(data.routers?.length > 0);
      })
      .catch(() => {
        setHasError(true);
        setHasRouter(false);
      });
  }, []);

  if (hasRouter === null && !hasError) {
    return <div className="h-full flex items-center justify-center"><CustomLoader message="Checking node status..." /></div>;
  }
  
  if (hasError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center animate-in fade-in">
        <Server className="w-10 h-10 text-rose-300 mb-4" />
        <h2 className="text-[16px] font-medium text-textPrimary mb-2">Backend Disconnected</h2>
        <p className="text-[13px] text-textSecondary max-w-sm">Movec Connect cannot reach the backend service to verify router modules.</p>
      </div>
    );
  }

  if (!hasRouter) {
    return <Navigate to="/network/routers" replace />;
  }
  
  return children;
};

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Still resolving auth state — show spinner
  if (session === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bgSecondary">
        <CustomLoader message="Authenticating..." />
      </div>
    );
  }

  // Not logged in — show public routes
  if (!session) {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/signup" element={<AuthPage initialMode="signup" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    );
  }

  // Logged in — show the full dashboard
  return (
    <Router>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Dashboard />} />

          {/* Customers */}
          <Route path="/customers/active" element={<ActiveUsers />} />
          <Route path="/customers/all"    element={<AllUsers />} />
          <Route path="/customers/add"    element={<AddCustomer />} />
          <Route path="/customers/edit/:id" element={<EditCustomer />} />
          <Route path="/customers/:id"    element={<CustomerProfile />} />
          <Route path="/customers"        element={<Navigate to="/customers/all" replace />} />

          {/* Billing */}
          <Route path="/packages"           element={<Packages />} />
          <Route path="/packages/add"       element={<AddPackage />} />
          <Route path="/packages/edit/:id" element={<EditPackage />} />
          <Route path="/payments"            element={<Payments />} />
          <Route path="/payment-monitor"     element={<PaymentMonitor />} />

          {/* Analytics & Comms */}
          <Route path="/statistics"   element={<Statistics />} />
          <Route path="/communication" element={<Communication />} />
          <Route path="/subscriptions" element={<Subscription />} />

          {/* Network Subsystem */}
          <Route path="/network/routers"           element={<RoutersList />} />
          <Route path="/network/routers/add"       element={<RouterWizard />} />
          <Route path="/network/routers/:id/edit"  element={<EditRouter />} />
          <Route path="/network/routers/:id"       element={<RouterDetail />} />

          <Route path="/network/hotspot"    element={<NetworkModuleRedirect tab="hotspot" label="Hotspot Profiles & Sessions" />} />
          <Route path="/network/pppoe"      element={<NetworkModuleRedirect tab="pppoe" label="PPPoE Server & Secrets" />} />
          <Route path="/network/dhcp"       element={<NetworkModuleRedirect tab="dhcp" label="DHCP Leases" />} />
          <Route path="/network/firewall"   element={<NetworkModuleRedirect tab="firewall" label="Firewall Rules" />} />
          <Route path="/network/interfaces" element={<NetworkModuleRedirect tab="interfaces" label="Interfaces Traffic" />} />
          <Route path="/network/wireless"   element={<NetworkModuleRedirect tab="wireless" label="Wireless Registrations" />} />
          <Route path="/network/stats"      element={<RouterStats />} />
          
          <Route path="/network/scripts"    element={<NetworkModuleRedirect tab="scripts" label="Routing Scripts & Schedulers" />} />
          <Route path="/network/monitor"    element={<LiveSessions />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/help"     element={<Placeholder title="Ticketing & Helpdesk" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
