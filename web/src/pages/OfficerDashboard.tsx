import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { formatDate } from '../lib/formatters';
import { Button } from '../components/ui/Button';
import { Toast, ToastType } from '../components/ui/Toast';
import { 
  Inbox, 
  CheckCircle2, 
  CalendarDays, 
  Award, 
  Gauge, 
  Smartphone, 
  ExternalLink,
  MapPin,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface OfficerDashboardData {
  officerId: string;
  name: string;
  role: 'LMO' | 'GATC';
  roleLabel: string;
  zoneId: string | null;
  zoneName: string;
  centreName: string | null;
  kpis: {
    awaitingResponse: number;
    accepted: number;
    todayVisits: number;
    completedMonth: number;
    capacityToday: {
      used: number;
      limit: number;
    };
  };
  needsResponse: Array<{
    id: string;
    state: string;
    business_name: string;
    business_address: string;
    business_phone: string | null;
    zone_name: string | null;
    instrument_id: string;
    instrument_class: string;
    serial: string;
    make: string;
    model: string;
    slot_date: string;
    slot_time: string;
  }>;
  todaySchedule: Array<{
    id: string;
    state: string;
    business_name: string;
    business_address: string;
    instrument_id: string;
    instrument_class: string;
    serial: string;
    make: string;
    model: string;
    slot_date: string;
    slot_time: string;
  }>;
  history: Array<{
    id: string;
    state: string;
    business_name: string;
    instrument_id: string;
    instrument_class: string;
    serial: string;
    certificate_public_id: string | null;
    certificate_status: string | null;
    slot_date: string | null;
  }>;
}

export function OfficerDashboard() {
  const [data, setData] = useState<OfficerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [rejectModalAppId, setRejectModalAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await get<OfficerDashboardData>('/api/dashboard/officer');
      setData(res);
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to load officer dashboard', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAccept = async (appId: string) => {
    try {
      await post('/api/appointments/accept', { applicationId: appId });
      setToast({ message: `Appointment ${appId} accepted. Ready for field inspection.`, type: 'success' });
      await loadDashboard();
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to accept appointment', type: 'error' });
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalAppId || !rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      await post('/api/appointments/reject', { 
        applicationId: rejectModalAppId, 
        reason: rejectReason.trim() 
      });
      setToast({ message: `Appointment rejected and returned to routing queue.`, type: 'info' });
      setRejectModalAppId(null);
      setRejectReason('');
      await loadDashboard();
    } catch (err: unknown) {
      const error = err as Error;
      setToast({ message: error.message || 'Failed to reject appointment', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calibration-blue mx-auto mb-2"></div>
        Loading verification pipeline...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded border border-red-200">
        Unable to load dashboard data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl">
      {/* Top Banner / Greeting */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading text-ink">Welcome back, {data.name}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-calibration-blue/10 text-calibration-blue">
              {data.role}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {data.roleLabel} • <span className="font-medium text-slate-800">{data.zoneName}</span>
            {data.centreName && <span className="text-slate-500"> ({data.centreName})</span>}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/field/jobs">
            <Button variant="primary" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Open in field app
            </Button>
          </Link>
        </div>
      </div>

      {/* 5 KPI Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Awaiting response</span>
            <Inbox className="w-4 h-4 text-stamp-amber" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-stamp-amber">{data.kpis.awaitingResponse}</span>
            <p className="text-xs text-slate-500 mt-1">Scheduled jobs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Accepted</span>
            <CheckCircle2 className="w-4 h-4 text-calibration-blue" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-calibration-blue">{data.kpis.accepted}</span>
            <p className="text-xs text-slate-500 mt-1">Ready for check</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's visits</span>
            <CalendarDays className="w-4 h-4 text-verified-green" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-verified-green">{data.kpis.todayVisits}</span>
            <p className="text-xs text-slate-500 mt-1">Scheduled today</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed (month)</span>
            <Award className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold font-mono text-ink">{data.kpis.completedMonth}</span>
            <p className="text-xs text-slate-500 mt-1">Inspections done</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Capacity today</span>
            <Gauge className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono text-ink">{data.kpis.capacityToday.used}</span>
              <span className="text-sm font-mono text-slate-500">/ {data.kpis.capacityToday.limit}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Used vs daily limit</p>
          </div>
        </div>
      </div>

      {/* Section: Needs your response */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold font-heading text-ink flex items-center gap-2">
              Needs Your Response
              {data.needsResponse.length > 0 && (
                <span className="bg-stamp-amber text-white text-xs px-2 py-0.5 rounded-full font-mono">
                  {data.needsResponse.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review assigned inspection appointments. Accept to confirm visit or reject to return to queue.
            </p>
          </div>
        </div>

        {data.needsResponse.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-verified-green mx-auto mb-2 opacity-80" />
            <p className="text-sm font-medium text-slate-700">All assigned jobs responded to</p>
            <p className="text-xs text-slate-400 mt-1">No pending verification jobs currently require confirmation.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.needsResponse.map(job => (
              <div key={job.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                      {job.id}
                    </span>
                    <span className="font-semibold text-ink text-base">{job.business_name}</span>
                    <span className="text-xs bg-blue-50 text-calibration-blue font-medium px-2 py-0.5 rounded border border-blue-100">
                      {job.instrument_class}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {job.business_address}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(job.slot_date)} • {job.slot_time}
                    </span>
                    <span className="font-mono text-slate-500">
                      SN: {job.serial || job.instrument_id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={() => handleAccept(job.id)}
                  >
                    Accept
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setRejectModalAppId(job.id)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: Today's Schedule by Slot */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold font-heading text-ink flex items-center gap-2">
              Today's Schedule
              <span className="text-xs font-normal text-slate-500">
                ({formatDate(new Date().toISOString().split('T')[0])})
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological inspection appointments planned for today.
            </p>
          </div>
        </div>

        {data.todaySchedule.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No visits scheduled for today</p>
            <p className="text-xs text-slate-400 mt-1">Check pending queue or future dates in the field app.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.todaySchedule.map(slot => (
              <div key={slot.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-24 shrink-0 text-center py-2 px-3 bg-slate-100 rounded border border-slate-200">
                    <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider">{slot.slot_time}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink">{slot.business_name}</h3>
                      <span className="font-mono text-xs text-slate-500">({slot.instrument_class})</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        slot.state === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                        slot.state === 'SCHEDULED' ? 'bg-amber-100 text-amber-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {slot.state}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {slot.business_address}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/field/jobs/${slot.id}`}>
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      Inspect on site
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: History & Link to Certificate Search */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-lg font-bold font-heading text-ink">Recent Verification History</h2>
            <p className="text-xs text-slate-500">Recently inspected instruments and generated certificates under your supervision.</p>
          </div>
          <Link to="/dashboard/search" className="text-sm font-semibold text-calibration-blue hover:underline flex items-center gap-1">
            Certificate Search <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {data.history.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-sm">
            No completed verification records recorded this month.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="pb-3">Application</th>
                  <th className="pb-3">Business</th>
                  <th className="pb-3">Instrument Class</th>
                  <th className="pb-3">Result</th>
                  <th className="pb-3">Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.history.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-mono text-xs">{item.id}</td>
                    <td className="py-3 font-medium text-ink">{item.business_name}</td>
                    <td className="py-3 text-slate-600">{item.instrument_class}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.state === 'CERTIFIED' ? 'bg-verified-green/10 text-verified-green' :
                        item.state === 'INSPECTED_PASS' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {item.state}
                      </span>
                    </td>
                    <td className="py-3">
                      {item.certificate_public_id ? (
                        <Link to={`/v/${item.certificate_public_id}`} className="font-mono text-xs text-calibration-blue hover:underline">
                          {item.certificate_public_id}
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModalAppId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2 text-stamp-amber mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-bold font-heading text-ink">Reject Assignment</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Specify the reason for returning application <span className="font-mono font-bold text-ink">{rejectModalAppId}</span> to the routing queue.
            </p>

            <div className="mb-4">
              <label htmlFor="reject-reason" className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Reason for Rejection *
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-calibration-blue focus:border-calibration-blue"
                placeholder="e.g., Outside working zone, scheduled equipment capacity limit reached..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setRejectModalAppId(null);
                  setRejectReason('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || isSubmitting}
              >
                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
