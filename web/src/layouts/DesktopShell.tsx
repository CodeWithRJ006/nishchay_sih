import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { DemoBadge } from '../components/ui/DemoBadge';

export const DesktopShell = ({ role = 'User', onSignOut }: { role?: string; onSignOut?: () => void }) => {
  const isDemo = true;
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/design', label: 'Design System' }
  ];

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col md:flex-row">
      <nav className="w-full md:w-64 bg-ink text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-heading font-bold text-white tracking-wide">NISHCHAY</h2>
          <p className="text-sm text-gray-400">{role} Portal</p>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-2">
          {links.map(l => (
            <Link 
              key={l.to} 
              to={l.to}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname === l.to ? 'bg-calibration-blue text-white' : 'text-gray-300 hover:bg-gray-800'}`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 h-16 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-ink">Welcome, {role}</span>
            {isDemo && <DemoBadge />}
          </div>
          {onSignOut && (
            <button onClick={onSignOut} className="text-sm font-semibold text-calibration-blue hover:underline">
              Sign Out
            </button>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
