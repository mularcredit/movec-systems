import React, { useState } from 'react';
import { Search, Plus, MoreVertical } from 'lucide-react';
import { SelectDropdown } from '../components/ui/SelectDropdown';

export default function Customers() {
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const users = [
    { id: '1', name: 'John Doe', email: 'john@example.com', package: 'Fiber 20Mbps', status: 'active', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', package: 'Fiber 50Mbps', status: 'suspended', bg: 'bg-rose-100', text: 'text-rose-700' },
    { id: '3', name: 'Alice Johnson', email: 'alice@example.com', package: 'Wireless 10Mbps', status: 'pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">Customers</h2>
        <button className="btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by name, email, or MAC address..." 
              className="pl-9 input-field bg-slate-50"
            />
          </div>
          <SelectDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            options={['All Statuses', 'Active', 'Suspended']}
            className="max-w-xs"
          />
        </div>
        
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm font-medium border-b border-slate-200">
              <th className="px-6 py-4">Customer</th>
              <th className="px-6 py-4">Package</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-800">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </td>
                <td className="px-6 py-4 text-slate-600 font-medium">
                  {user.package}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${user.bg} ${user.text}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-slate-700 transition">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
