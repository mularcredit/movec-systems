/**
 * NetworkModuleRedirect
 *
 * Smart redirect component for sidebar network module links.
 * Fetches the first available router for this tenant and redirects
 * directly to the correct tab inside RouterDetail.
 *
 * If no router exists, shows a prompt to add one.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconActivity, IconArrowRight, IconLoader2, IconPlus, IconServer } from '@tabler/icons-react';;
import CustomLoader from '../../components/common/CustomLoader';

import { apiFetch } from '../../lib/apiClient';

interface Props {
  tab: string;
  label: string;
}

export default function NetworkModuleRedirect({ tab, label }: Props) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'no_router' | 'select_router' | 'error'>('loading');
  const [routers, setRouters] = useState<any[]>([]);

  useEffect(() => {
    setStatus('loading');
    apiFetch('/api/router')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.routers?.length > 0) {
          if (data.routers.length === 1) {
            // Auto-redirect if only one router exists
            navigate(`/network/routers/${data.routers[0].id}?tab=${tab}`, { replace: true });
          } else {
            // Multiple routers exist: Prompt user to choose
            setRouters(data.routers);
            setStatus('select_router');
          }
        } else {
          setStatus('no_router');
        }
      })
      .catch(() => setStatus('error'));
  }, [navigate, tab]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] animate-in fade-in">
        <CustomLoader />
        <p className="text-[14px] text-textSecondary font-medium tracking-wide">Locating active gateways...</p>
      </div>
    );
  }

  if (status === 'select_router') {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-100/50 shadow-sm">
            <IconActivity className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-semibold text-textPrimary mb-2">Select a Target Router</h2>
          <p className="text-[15px] text-textSecondary max-w-md mx-auto leading-relaxed">
            You have multiple active gateways. Please choose which router you want to inspect for <span className="font-semibold text-textPrimary">{label}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {routers.map(router => (
            <div 
              key={router.id}
              onClick={() => navigate(`/network/routers/${router.id}?tab=${tab}`)}
              className="bg-bgSecondary border border-white/10/70 p-5 rounded-2xl cursor-pointer hover:border-emerald-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group text-left"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                  <IconServer className="w-5 h-5 text-textSecondary group-hover:text-emerald-500 transition-colors" />
                </div>
                {router.connection_status === 'online' ? (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[11px] font-bold tracking-wide uppercase">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 text-textSecondary rounded-full text-[11px] font-bold tracking-wide uppercase">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> Offline
                  </span>
                )}
              </div>
              <h3 className="text-[16px] font-semibold text-textPrimary mb-1 line-clamp-1">{router.name}</h3>
              <p className="font-mono text-[13px] text-textSecondary mb-4">{router.ip_address}</p>
              
              <div className="flex items-center justify-between text-[13px] font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>View {label}</span>
                <IconArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center animate-in fade-in p-10">
      <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-5">
        <IconServer className="w-8 h-8 text-textSecondary" />
      </div>
      <h2 className="text-[16px] font-medium text-textPrimary mb-2">No Router Linked</h2>
      <p className="text-[13px] text-textSecondary max-w-xs mb-6">
        {status === 'error'
          ? 'Cannot reach the backend service. Make sure the server is running.'
          : `You need to link a MikroTik router before accessing ${label}.`}
      </p>
      {status === 'no_router' && (
        <button
          onClick={() => navigate('/network/routers/add')}
          className="btn-primary flex items-center"
        >
          <IconPlus className="w-4 h-4 mr-2" /> Link a Router
        </button>
      )}
    </div>
  );
}
