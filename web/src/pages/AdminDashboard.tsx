import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { formatInr, formatDate } from '../lib/formatters';
import { Button } from '../components/ui/Button';
import { Toast, ToastType } from '../components/ui/Toast';
import { 
  FileText, 
  Award, 
  IndianRupee, 
  AlertCircle, 
  ShieldAlert, 
  Activity, 
  ArrowRight,
  UserCheck
} from 'lucide-react';

interface AdminDashboardData {
  kpis: {
    applications: number;
    validCertificates: number;
    feesCollected: number;
    openComplaints: number;
    gateBlocks: number;
  };
  applicationsByState: Array<{
    state: string;
    count: number;
    percentage: number;
  }>;
  unassignedQueue: Array<{
    id: string;
    state: string;
    business_name: string;
    zone_id: string | null;
    instrument_id: string;
    slot_date?: string;
    slot_time?: string;
  }>;
  paymentsAndGateBlocks: {
    payments: Array<{
      id: string;
      application_id: string;
      amount: number;
      status: string;
      created_at: string;
      business_name: string;
    }>;
    gateBlockCount: number;
  };
  complaints: {
    list: Array<{
      id: number;
      public_id: string;
      category: string;
      note: string;
      created_at: string;
      business_name: string | null;
      business_id: string | null;
    }>;
    byBusiness: Array<{
      business_name: string;
      count: number;
    }>;
  };
  activityFeed: Array<{
    id: string;
    action: string;
    message: string;
    timestamp: string;
  }>;
}

interface OfficerOption {
  id: string;
  name: string;
  role: string;
  zone_id?: string;
  zone_name?: string;
}

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: 'bg-slate-400', text: 'text-slate-600' },
  SUBMITTED: { bg: 'bg-indigo-500', text: 'text-indigo-600' },
  PAID: { bg: 'bg-calibration-blue', text: 'text-calibration-blue' },
  SCHEDULED: { bg: 'bg-stamp-amber', text: 'text-amber-600' },
  ACCEPTED: { bg: 'bg-purple-500', text: 'text-purple-600' },
  INSPECTED_PASS: { bg: 'bg-cyan-600', text: 'text-cyan-700' },
  CERTIFIED: { bg: 'bg-verified-green', text: 'text-verified-green' },
  FAILED: { bg: 'bg-red-500', text: 'text-red-600' },
  CANCELLED: { bg: 'bg-gray-400', text: 'text-gray-500' },
};

export function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [activityFeed, setActivityFeed] = useState<AdminDashboardData['activityFeed']>([]);
  const [officers, setOfficers] = useState<OfficerOption[]>([]);
  const [assignModalAppId, setAssignModalAppId] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await get<AdminDashboardData>('/api/dashboard/admin');
      setData(res);
      setActivityFeed(res.activityFeed);
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to load admin dashboard', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOfficers = useCallback(async () => {
    try {
      const res = await get<OfficerOption[]>('/api/admin/officers');
      setOfficers(res);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchOfficers();
  }, [fetchDashboard, fetchOfficers]);

  // Live activity feed polling every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const feed = await get<AdminDashboardData['activityFeed']>('/api/admin/activity-feed');
        setActivityFeed(feed);
      } catch {
        // quiet failure during polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleAssign = async () => {
    if (!assignModalAppId || !selectedOfficerId) return;
    try {
      await post('/api/admin/assign', {
        applicationId: assignModalAppId,
        officerId: selectedOfficerId,
      });
      setToast({ message: `Application ${assignModalAppId} successfully assigned.`, type: 'success' });
      setAssignModalAppId(null);
      setSelectedOfficerId('');
      await fetchDashboard();
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to assign officer', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calibration-blue mx-auto mb-2"></div>
        Loading administrator telemetric dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded border border-red-200">
        Unable to load admin dashboard.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-ink">Administrator Overview</h1>
        <p className="text-sm text-slate-600 mt-1">
          System-wide legal metrology verification pipeline, gate telemetry, and audit monitoring.
        </p>
      </div>

      {/* 5 KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Applications</span>
            <FileText className="w-4 h-4 text-calibration-blue" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-ink">{data.kpis.applications}</span>
            <p className="text-xs text-slate-500 mt-1">Total in system</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Valid Seals</span>
            <Award className="w-4 h-4 text-verified-green" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-verified-green">{data.kpis.validCertificates}</span>
            <p className="text-xs text-slate-500 mt-1">Certified instruments</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Fees Collected</span>
            <IndianRupee className="w-4 h-4 text-slate-700" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-ink">{formatInr(data.kpis.feesCollected)}</span>
            <p className="text-xs text-slate-500 mt-1">Sandbox demo rupees</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Open Complaints</span>
            <AlertCircle className="w-4 h-4 text-stamp-amber" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-stamp-amber">{data.kpis.openComplaints}</span>
            <p className="text-xs text-slate-500 mt-1">Right to Check logs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Gate Blocks</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-red-600">{data.kpis.gateBlocks}</span>
            <p className="text-xs text-slate-500 mt-1">Fee violations thwarted</p>
          </div>
        </div>
      </div>

      {/* Applications by State as ONE Accessible Horizontal Bar */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold font-heading text-ink">Applications by Lifecycle State</h2>
          <span className="text-xs font-mono text-slate-500">{data.kpis.applications} total records</span>
        </div>

        {/* Single accessible horizontal bar */}
        <div 
          className="h-6 w-full flex rounded-md overflow-hidden bg-slate-100 p-0.5 border border-slate-200" 
          role="img" 
          aria-label="Applications breakdown by state: "
        >
          {data.applicationsByState.map(s => {
            if (s.count === 0) return null;
            const styling = STATE_COLORS[s.state] || { bg: 'bg-slate-400', text: 'text-slate-600' };
            return (
              <div
                key={s.state}
                className={`${styling.bg} h-full transition-all duration-300 relative group first:rounded-l last:rounded-r`}
                style={{ width: `${Math.max(s.percentage, 3)}%` }}
                title={`${s.state}: ${s.count} (${s.percentage}%)`}
              />
            );
          })}
        </div>

        {/* Accessible Legend Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
          {data.applicationsByState.map(s => {
            const styling = STATE_COLORS[s.state] || { bg: 'bg-slate-400', text: 'text-slate-600' };
            return (
              <div key={s.state} className="flex items-center gap-2 text-xs">
                <span className={`w-3 h-3 rounded-full ${styling.bg} shrink-0`} />
                <span className="font-medium text-slate-700">{s.state}:</span>
                <span className="font-mono text-slate-900 font-bold">{s.count}</span>
                <span className="text-slate-400">({s.percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid: Unassigned Queue & Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Unassigned Queue (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold font-heading text-ink flex items-center gap-2">
                  Unassigned Verification Queue
                  {data.unassignedQueue.length > 0 && (
                    <span className="bg-stamp-amber text-white text-xs px-2 py-0.5 rounded-full font-mono">
                      {data.unassignedQueue.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paid applications requiring manual administrative assignment to a designated officer.
                </p>
              </div>
              <Link to="/dashboard/unassigned" className="text-xs text-calibration-blue font-semibold hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data.unassignedQueue.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <UserCheck className="w-8 h-8 text-verified-green mx-auto mb-2 opacity-80" />
                <p className="text-sm font-medium text-slate-700">All paid applications assigned</p>
                <p className="text-xs text-slate-400 mt-1">Automatic workload distribution routed all current verification requests.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.unassignedQueue.map(item => (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {item.id}
                        </span>
                        <span className="font-semibold text-sm text-ink">{item.business_name}</span>
                        <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-800 rounded font-medium border border-amber-200">
                          {item.zone_id || 'No Zone'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        Instrument: {item.instrument_id} {item.slot_date ? `• Preferred Date: ${item.slot_date}` : ''}
                      </div>
                    </div>

                    <div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setAssignModalAppId(item.id)}
                      >
                        Assign Officer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live Activity Feed (1 col) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-verified-green animate-pulse" />
              <h2 className="text-sm font-bold font-heading text-ink">Live Activity Feed</h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-verified-green animate-ping" />
              <span>Polling 3s</span>
            </div>
          </div>

          <div className="p-4 divide-y divide-slate-100 overflow-y-auto max-h-[360px]">
            {activityFeed.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity logged.</p>
            ) : (
              activityFeed.map(feed => (
                <div key={feed.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                  <p className="text-slate-800 font-medium leading-relaxed">{feed.message}</p>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    {formatDate(feed.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Two Column Grid: Payments/Gate Blocks & Right to Check Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments & Gate Blocks */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold font-heading text-ink">Recent Official Payments</h2>
              <p className="text-xs text-slate-500">e-Receipt transactions verified through the financial gate.</p>
            </div>
            <Link to="/dashboard/finance" className="text-xs text-calibration-blue font-semibold hover:underline">
              View receipts →
            </Link>
          </div>

          {/* Gate block alert card */}
          <div className="my-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-red-900 font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Fee-Gate Telemetry: {data.kpis.gateBlocks} issuance attempts blocked
              </div>
              <p className="text-xs text-red-800/80 mt-0.5">
                The fee-gate removes the officer's control over official fee transactions.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="pb-2">Payment ID</th>
                  <th className="pb-2">Business</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.paymentsAndGateBlocks.payments.slice(0, 5).map(p => (
                  <tr key={p.id}>
                    <td className="py-2.5 font-mono text-slate-700">{p.id}</td>
                    <td className="py-2.5 font-medium text-slate-900">{p.business_name}</td>
                    <td className="py-2.5 font-mono font-bold text-ink">{formatInr(p.amount)}</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right to Check Complaints with Per-Business Counts */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold font-heading text-ink">Right to Check Complaints</h2>
              <p className="text-xs text-slate-500">Public consumer grievance telemetry logged per merchant.</p>
            </div>
            <Link to="/dashboard/complaints" className="text-xs text-calibration-blue font-semibold hover:underline">
              All complaints →
            </Link>
          </div>

          {/* Per-Business summary chips */}
          <div className="my-4">
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider block mb-2">
              Complaints by Business
            </span>
            <div className="flex flex-wrap gap-2">
              {data.complaints.byBusiness.length === 0 ? (
                <span className="text-xs text-slate-400">No complaints filed against any business.</span>
              ) : (
                data.complaints.byBusiness.map(b => (
                  <span key={b.business_name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800">
                    <span>{b.business_name}:</span>
                    <span className="font-mono font-bold text-red-600">{b.count}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Recent complaints table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="pb-2">Certificate</th>
                  <th className="pb-2">Business</th>
                  <th className="pb-2">Category</th>
                  <th className="pb-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.complaints.list.slice(0, 4).map(c => (
                  <tr key={c.id}>
                    <td className="py-2.5 font-mono text-calibration-blue">
                      <Link to={`/v/${c.public_id}`} className="hover:underline">
                        {c.public_id.slice(0, 12)}...
                      </Link>
                    </td>
                    <td className="py-2.5 font-medium text-slate-900">{c.business_name || 'Unknown'}</td>
                    <td className="py-2.5 text-slate-600">{c.category}</td>
                    <td className="py-2.5 text-slate-500 max-w-xs truncate" title={c.note}>
                      {c.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Assignment Modal */}
      {assignModalAppId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold font-heading text-ink mb-2">Assign Officer</h3>
            <p className="text-sm text-slate-600 mb-4">
              Manually assign application <span className="font-mono font-bold text-ink">{assignModalAppId}</span> to an authorized inspector.
            </p>

            <div className="mb-4">
              <label htmlFor="select-officer" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Designated Officer *
              </label>
              <select
                id="select-officer"
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-calibration-blue focus:border-calibration-blue"
                value={selectedOfficerId}
                onChange={e => setSelectedOfficerId(e.target.value)}
              >
                <option value="">Select an officer...</option>
                {officers.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.role} • {o.zone_name || o.zone_id || 'All Zones'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAssignModalAppId(null);
                  setSelectedOfficerId('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleAssign}
                disabled={!selectedOfficerId}
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
