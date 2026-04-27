import React, { useState, useEffect } from 'react';
import { IconActivity, IconDotsVertical, IconMapPin, IconPlus, IconSearch, IconShieldCheck, IconWifi, IconWifiOff } from '@tabler/icons-react';;
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/apiClient';

export default function Customers() {
  document.title = 'Customers | Movec Connect';
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Customers from DB
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select(`
          *,
          packages (display_name, speed_limit)
        `)
        .order('full_name', { ascending: true });

      if (custErr) throw custErr;

      // 2. Fetch Active Sessions from MikroTik API
      const res = await apiFetch('/api/router/sessions/all');
      const sessionData = await res.json();
      
      setCustomers(custData || []);
      setActiveSessions(sessionData.sessions || []);
    } catch (err) {
      console.error('Failed to load customer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.account_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isActiveSession = activeSessions.some(s => s.username === c.username);
    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Online' && isActiveSession) ||
      (statusFilter === 'Offline' && !isActiveSession) ||
      (statusFilter === 'Suspended' && c.status === 'suspended');

    return matchesSearch && matchesStatus;
  });

  const getSessionInfo = (username: string) => {
    return activeSessions.find(s => s.username === username);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-textPrimary tracking-tight">Subscriber Base</h2>
          <p className="text-textSecondary mt-1">Manage and monitor live user connectivity</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center">
          <IconPlus className="w-5 h-5 mr-2" />
          Add Subscriber
        </button>
      </div>

      <div className="card bg-bgSecondary border border-white/10 rounded-3xl p-0 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-white/5 bg-white/5/30 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by name, username, or account #..." 
              className="pl-12 w-full bg-bgSecondary border border-white/10 rounded-2xl py-3 text-[14px] focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex bg-bgSecondary border border-white/10 rounded-2xl p-1 shadow-sm">
            {['All', 'Online', 'Offline', 'Suspended'].map(tab => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${statusFilter === tab ? 'bg-bgPrimary text-white shadow-md' : 'text-textSecondary hover:text-textPrimary'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-[11px] font-black text-textSecondary uppercase tracking-widest border-b border-white/5">
                <th className="px-6 py-5">Subscriber / Details</th>
                <th className="px-6 py-5 text-center">Service Type</th>
                <th className="px-6 py-5">Connection Details</th>
                <th className="px-6 py-5">Billing Status</th>
                <th className="px-6 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <IconActivity className="w-8 h-8 text-blue-500 animate-pulse" />
                      <p className="text-textSecondary font-medium italic">Scanning network for active sessions...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <IconSearch className="w-10 h-10 text-white/30" />
                      <p className="text-textSecondary font-medium">No subscribers found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.map((c) => {
                const session = getSessionInfo(c.username);
                const isOnline = !!session;

                return (
                  <tr key={c.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${isOnline ? 'bg-emerald-50' : 'bg-white/10'} group-hover:scale-105 transition-transform`}>
                          {isOnline ? <IconWifi className="w-5 h-5 text-emerald-600" /> : <IconWifiOff className="w-5 h-5 text-textSecondary" />}
                        </div>
                        <div>
                          <p className="font-bold text-textPrimary text-[15px]">{c.full_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[12px] font-mono font-bold text-textSecondary px-1.5 py-0.5 bg-white/10 rounded">@{c.username}</span>
                            <span className="text-[11px] font-medium text-textSecondary flex items-center">
                              <IconMapPin className="w-3 h-3 mr-1" />
                              {c.address || 'No Location'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${c.service_type === 'PPPoE' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                         {c.service_type}
                       </span>
                    </td>
                    <td className="px-6 py-5">
                      {isOnline ? (
                        <div className="space-y-1">
                          <p className="text-[13px] font-bold text-emerald-700 flex items-center">
                            <IconActivity className="w-3 h-3 mr-1.5" />
                            {session.address}
                          </p>
                          <p className="text-[11px] font-medium text-textSecondary">Uptime: <span className="text-textPrimary font-bold">{session.uptime}</span></p>
                        </div>
                      ) : (
                        <p className="text-[12px] font-medium text-textSecondary italic">Disconnected</p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${c.status === 'active' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          {c.status}
                        </span>
                        {c.next_due_date && (
                          <span className="text-[11px] font-medium text-textSecondary">Due: {new Date(c.next_due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                         <button className="p-2.5 bg-bgSecondary border border-white/10 rounded-xl text-textSecondary hover:bg-white/5 hover:text-textPrimary transition-all shadow-sm">
                           <IconShieldCheck className="w-4 h-4" />
                         </button>
                         <button className="p-2.5 bg-bgSecondary border border-white/10 rounded-xl text-textSecondary hover:bg-white/5 hover:text-textPrimary transition-all shadow-sm">
                           <IconDotsVertical className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
