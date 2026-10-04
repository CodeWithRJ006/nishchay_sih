import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, X, ShieldCheck, ChevronDown } from 'lucide-react';
import { DemoBadge } from '../components/ui/DemoBadge';
import { DEMO_MODE } from '../lib/demo';
import { post } from '../lib/api';
import { useAuth } from '../AuthContext';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  LMO: 'Legal Metrology Officer',
  GATC: 'Government Approved Test Centre',
  BUSINESS: 'Business',
};

export const DesktopShell = ({ role = 'BUSINESS', onSignOut }: { role?: string; onSignOut?: () => void }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const location = useLocation();
  const { user, refresh } = useAuth();

  const currentRole = user?.role || role;
  const roleLabel = ROLE_LABELS[currentRole] || currentRole;
  const userName = user?.name || user?.email || 'User';

  const getLinks = () => {
    if (currentRole === 'BUSINESS') {
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/dashboard/applications', label: 'Applications' },
        { to: '/dashboard/instruments', label: 'Instruments' },
        { to: '/dashboard/apply', label: 'New application' },
        { to: '/dashboard/profile', label: 'Business profile' },
        { to: '/dashboard/search', label: 'Certificate search' },
      ];
    }
    if (currentRole === 'LMO' || currentRole === 'GATC') {
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/dashboard/my-jobs', label: 'My jobs' },
        { to: '/dashboard/profile', label: 'Profile' },
        { to: '/dashboard/search', label: 'Certificate search' },
      ];
    }
    if (currentRole === 'ADMIN') {
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/dashboard/applications', label: 'Applications' },
        { to: '/dashboard/unassigned', label: 'Unassigned jobs' },
        { to: '/dashboard/finance', label: 'Payments' },
        { to: '/dashboard/complaints', label: 'Complaints' },
        { to: '/dashboard/certificates', label: 'Certificates' },
        { to: '/dashboard/provision', label: 'Provision accounts' },
        { to: '/dashboard/search', label: 'Certificate search' },
      ];
    }
    return [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/dashboard/search', label: 'Certificate Search' },
    ];
  };

  const links = getLinks();

  const handleSwitchRole = async (targetRole: string) => {
    try {
      await post(`/api/demo/login-as/${targetRole}`, {});
      setSwitcherOpen(false);
      setMobileMenuOpen(false);
      await refresh();
      window.location.href = '/dashboard';
    } catch {
      window.location.href = '/dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col lg:flex-row overflow-x-hidden">
      {/* Mobile Header below 1024px */}
      <div className="lg:hidden bg-ink text-white p-4 flex items-center justify-between border-b border-gray-700">
        <Link to="/" className="text-xl font-heading font-bold text-white tracking-wide">
          NISHCHAY
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-white hover:bg-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav
        aria-label="Main Navigation"
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } lg:block w-full lg:w-64 bg-ink text-white flex flex-col shrink-0`}
      >
        <div className="hidden lg:block p-4 border-b border-gray-700">
          <Link to="/" className="text-xl font-heading font-bold text-white tracking-wide block">
            NISHCHAY
          </Link>
          <p className="text-xs text-gray-400 mt-1">{roleLabel}</p>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                location.pathname === l.to
                  ? 'bg-calibration-blue text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {DEMO_MODE && (
            <div className="mt-6 pt-4 border-t border-gray-700 lg:hidden">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 px-3">
                Demo: Switch Role
              </span>
              <div className="grid grid-cols-2 gap-2 px-1">
                <button
                  type="button"
                  onClick={() => handleSwitchRole('BUSINESS')}
                  className={`px-2 py-1.5 rounded text-xs text-left ${currentRole === 'BUSINESS' ? 'bg-calibration-blue text-white font-bold' : 'bg-gray-800 text-gray-200'}`}
                >
                  Business
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('LMO')}
                  className={`px-2 py-1.5 rounded text-xs text-left ${currentRole === 'LMO' ? 'bg-calibration-blue text-white font-bold' : 'bg-gray-800 text-gray-200'}`}
                >
                  LMO
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('GATC')}
                  className={`px-2 py-1.5 rounded text-xs text-left ${currentRole === 'GATC' ? 'bg-calibration-blue text-white font-bold' : 'bg-gray-800 text-gray-200'}`}
                >
                  GATC
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchRole('ADMIN')}
                  className={`px-2 py-1.5 rounded text-xs text-left ${currentRole === 'ADMIN' ? 'bg-calibration-blue text-white font-bold' : 'bg-gray-800 text-gray-200'}`}
                >
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 min-h-16 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/" className="text-lg font-heading font-bold text-ink tracking-wide mr-2">
              NISHCHAY
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold text-ink text-sm sm:text-base">{userName}</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                {roleLabel}
              </span>
            </div>
            {DEMO_MODE && <DemoBadge />}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="text-sm font-semibold text-calibration-blue hover:underline flex items-center gap-1"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Verify a certificate</span>
            </Link>

            {DEMO_MODE && (
              <div className="relative">
                <button
                  type="button"
                  data-testid="switch-role-button"
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded text-xs font-semibold bg-gray-50 hover:bg-gray-100 flex items-center gap-1.5 text-gray-800"
                  aria-expanded={switcherOpen}
                  aria-haspopup="true"
                >
                  <span>Switch Role</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {switcherOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setSwitcherOpen(false)} 
                      aria-hidden="true" 
                    />
                    <div
                      className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 text-left"
                      role="menu"
                    >
                      <button
                        type="button"
                        data-testid="switch-role-business"
                        onClick={() => handleSwitchRole('BUSINESS')}
                        className={`w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex flex-col ${
                          currentRole === 'BUSINESS' ? 'bg-blue-50 font-bold text-calibration-blue' : 'text-gray-700'
                        }`}
                        role="menuitem"
                      >
                        <span className="font-semibold text-sm">Business</span>
                        <span className="text-xs text-gray-500">biz1@nishchay.example</span>
                      </button>
                      <button
                        type="button"
                        data-testid="switch-role-lmo"
                        onClick={() => handleSwitchRole('LMO')}
                        className={`w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex flex-col ${
                          currentRole === 'LMO' ? 'bg-blue-50 font-bold text-calibration-blue' : 'text-gray-700'
                        }`}
                        role="menuitem"
                      >
                        <span className="font-semibold text-sm">Legal Metrology Officer</span>
                        <span className="text-xs text-gray-500">lmo1@nishchay.example</span>
                      </button>
                      <button
                        type="button"
                        data-testid="switch-role-gatc"
                        onClick={() => handleSwitchRole('GATC')}
                        className={`w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex flex-col ${
                          currentRole === 'GATC' ? 'bg-blue-50 font-bold text-calibration-blue' : 'text-gray-700'
                        }`}
                        role="menuitem"
                      >
                        <span className="font-semibold text-sm">Government Approved Test Centre</span>
                        <span className="text-xs text-gray-500">gatc1@nishchay.example</span>
                      </button>
                      <button
                        type="button"
                        data-testid="switch-role-admin"
                        onClick={() => handleSwitchRole('ADMIN')}
                        className={`w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex flex-col ${
                          currentRole === 'ADMIN' ? 'bg-blue-50 font-bold text-calibration-blue' : 'text-gray-700'
                        }`}
                        role="menuitem"
                      >
                        <span className="font-semibold text-sm">Administrator</span>
                        <span className="text-xs text-gray-500">admin@nishchay.example</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="text-sm font-semibold text-calibration-blue hover:underline"
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
