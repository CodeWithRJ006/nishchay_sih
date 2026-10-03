import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Scale, 
  ShieldCheck, 
  Clock, 
  CreditCard, 
  ArrowRight, 
  ExternalLink, 
  QrCode, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  X,
  FileCheck
} from 'lucide-react';
import QRCode from 'qrcode';
import { get } from '../lib/api';
import { formatInr, formatDate } from '../lib/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface DashboardData {
  tradeName: string;
  businessId: string;
  kpis: {
    totalInstruments: number;
    validCertificates: number;
    openApplications: number;
    feesPaid: number;
  };
  nextStep: {
    title: string;
    description: string;
    actionLabel: string;
    actionUrl: string;
  };
  applicationsInProgress: Array<{
    id: string;
    state: string;
    fee_amount: number;
    created_at: string;
    instrument_id: string;
    instrument_make: string;
    instrument_model: string;
    instrument_serial: string;
    instrument_class: string;
    slot_date: string | null;
    slot_time: string | null;
    appointment_status: string | null;
    officer_name: string | null;
  }>;
  instruments: Array<{
    id: string;
    typeCode: string;
    make: string;
    model: string;
    serial: string;
    capacity: string;
    accuracyClass: string | null;
    location: string | null;
    status: 'CERTIFIED' | 'EXPIRED' | 'PENDING' | 'UNVERIFIED';
    validUntil: string | null;
    certificatePublicId: string | null;
  }>;
  recentPayments: Array<{
    payment_id: string;
    receipt_id: string;
    application_id: string;
    amount: number;
    created_at: string;
    instrument_info: string;
    instrument_serial: string;
  }>;
  certificates: Array<{
    public_id: string;
    valid_from: string;
    valid_to: string;
    status: string;
    instrument_id: string;
    instrument_info: string;
    instrument_serial: string;
    instrument_class: string;
  }>;
}

const APP_STEPS = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'PAID', label: 'Paid' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'INSPECTED_PASS', label: 'Inspected' },
  { key: 'CERTIFIED', label: 'Certified' },
];

function getStepIndex(state: string): number {
  switch (state) {
    case 'SUBMITTED': return 0;
    case 'PAID': return 1;
    case 'SCHEDULED':
    case 'ACCEPTED': return 2;
    case 'INSPECTED_PASS': return 3;
    case 'CERTIFIED': return 4;
    default: return 0;
  }
}

export function BusinessDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // QR modal state
  const [qrModalCert, setQrModalCert] = useState<{ publicId: string; instrumentInfo: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    get<DashboardData>('/api/dashboard/business')
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load business dashboard');
        setLoading(false);
      });
  }, []);

  const openQrModal = async (publicId: string, instrumentInfo: string) => {
    setQrModalCert({ publicId, instrumentInfo });
    const verifyUrl = `${window.location.origin}/v/${publicId}`;
    try {
      const url = await QRCode.toDataURL(verifyUrl, { width: 260, margin: 1 });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl('');
    }
  };

  const closeQrModal = () => {
    setQrModalCert(null);
    setQrDataUrl('');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="h-28 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-24 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>{error || 'Unable to display dashboard data.'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header & Greeting */}
      <div>
        <h1 className="text-3xl font-bold font-heading text-nsh-text tracking-tight">
          Welcome back, {data.tradeName}
        </h1>
        <p className="text-base text-slate-600 mt-1">
          Monitor your certified weighing and measuring instruments, open applications, and verified seals.
        </p>
      </div>

      {/* KPI Tiles (At most 4) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Total Instruments */}
        <Card className="p-5 border border-slate-200 shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Total instruments</span>
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-calibration-blue">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-bold font-heading text-nsh-text">
            {data.kpis.totalInstruments}
          </div>
          <div className="mt-1 text-xs text-slate-500">Registered commercial units</div>
        </Card>

        {/* Tile 2: Valid Certificates */}
        <Card className="p-5 border border-slate-200 shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Valid certificates</span>
            <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-verified-green">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-bold font-heading text-verified-green">
            {data.kpis.validCertificates}
          </div>
          <div className="mt-1 text-xs text-slate-500">Active verification seals</div>
        </Card>

        {/* Tile 3: Open Applications */}
        <Card className="p-5 border border-slate-200 shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Open applications</span>
            <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-bold font-heading text-amber-700">
            {data.kpis.openApplications}
          </div>
          <div className="mt-1 text-xs text-slate-500">In verification pipeline</div>
        </Card>

        {/* Tile 4: Fees Paid */}
        <Card className="p-5 border border-slate-200 shadow-sm bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600">Fees paid</span>
            <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center text-purple-700">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl lg:text-3xl font-bold font-mono text-nsh-text">
            {formatInr(data.kpis.feesPaid)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Demo statutory receipts</div>
        </Card>
      </div>

      {/* Your Next Step Banner */}
      <div className="bg-blue-50/70 border-l-4 border-calibration-blue p-5 rounded-r-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-calibration-blue mb-1">
            Your next step
          </div>
          <h2 className="text-lg font-bold font-heading text-slate-900">
            {data.nextStep.title}
          </h2>
          <p className="text-sm text-slate-700 mt-0.5 max-w-2xl leading-relaxed">
            {data.nextStep.description}
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => navigate(data.nextStep.actionUrl)}
          className="shrink-0 flex items-center gap-2"
        >
          {data.nextStep.actionLabel}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Applications in Progress with Tick-Scale Timelines */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-heading text-nsh-text">Applications in progress</h2>
            <p className="text-xs text-slate-500">Active verification workflows under Legal Metrology evaluation.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/applications')}>
            View all applications
          </Button>
        </div>

        {data.applicationsInProgress.length === 0 ? (
          <Card className="p-8 text-center border border-dashed border-slate-300 bg-slate-50/50">
            <FileCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <div className="text-base font-medium text-slate-800">No active applications in progress</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              All previous applications have completed verification or no submissions are currently pending.
            </p>
            <Button 
              variant="primary" 
              size="sm" 
              className="mt-4" 
              onClick={() => navigate('/dashboard/apply')}
            >
              Start new application
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.applicationsInProgress.map(app => {
              const activeStepIdx = getStepIndex(app.state);
              return (
                <Card key={app.id} className="p-5 border border-slate-200 bg-white shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-calibration-blue">{app.id}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 uppercase tracking-wide">
                          {app.state}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 mt-1">
                        {app.instrument_make} {app.instrument_model} • SN: <span className="font-mono">{app.instrument_serial}</span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-500">Official fee</div>
                      <div className="text-sm font-bold font-mono text-slate-900">{formatInr(app.fee_amount)}</div>
                    </div>
                  </div>

                  {/* Tick-Scale Timeline */}
                  <div className="pt-2">
                    <div className="relative flex items-center justify-between max-w-2xl mx-auto">
                      {/* Connecting Line */}
                      <div className="absolute left-0 top-3 w-full h-0.5 bg-slate-200 -z-0"></div>
                      <div 
                        className="absolute left-0 top-3 h-0.5 bg-calibration-blue -z-0 transition-all duration-300" 
                        style={{ width: `${(activeStepIdx / (APP_STEPS.length - 1)) * 100}%` }}
                      ></div>

                      {APP_STEPS.map((s, idx) => {
                        const isDone = idx < activeStepIdx;
                        const isCurrent = idx === activeStepIdx;
                        return (
                          <div key={s.key} className="flex flex-col items-center z-10">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                              isDone 
                                ? 'bg-verified-green text-white' 
                                : isCurrent 
                                  ? 'bg-calibration-blue text-white ring-4 ring-blue-100' 
                                  : 'bg-slate-200 text-slate-500'
                            }`}>
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <span className={`text-[11px] mt-1 text-center font-medium ${
                              isCurrent ? 'text-calibration-blue font-bold' : isDone ? 'text-slate-800' : 'text-slate-400'
                            }`}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Appointment Notice if Scheduled */}
                    {app.slot_date && (
                      <div className="mt-4 text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded flex items-center justify-between">
                        <span>
                          <strong>Inspection slot:</strong> {formatDate(app.slot_date)} ({app.slot_time || 'Scheduled slot'})
                          {app.officer_name ? ` • Assigned officer: ${app.officer_name}` : ''}
                        </span>
                        <span className="font-semibold text-amber-800">Premises inspection</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/dashboard/applications/${app.id}`)}
                      className="text-xs"
                    >
                      View application details &rarr;
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Instruments Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-heading text-nsh-text">Registered instruments</h2>
            <p className="text-xs text-slate-500">Commercial equipment registered for Legal Metrology compliance.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/instruments')}>
            Manage instruments
          </Button>
        </div>

        {data.instruments.length === 0 ? (
          <Card className="p-8 text-center border border-dashed border-slate-300 bg-slate-50/50">
            <Scale className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <div className="text-base font-medium text-slate-800">No instruments registered yet</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Add your commercial weighing and measuring equipment to initiate the certification process.
            </p>
            <Button 
              variant="primary" 
              size="sm" 
              className="mt-4" 
              onClick={() => navigate('/dashboard/instruments')}
            >
              Register your first instrument
            </Button>
          </Card>
        ) : (
          <Card className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Instrument</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Serial number</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Valid until</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.instruments.map(inst => (
                  <tr key={inst.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {inst.make} {inst.model}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">{inst.typeCode}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">{inst.serial}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">{inst.capacity}</td>
                    <td className="py-3.5 px-4">
                      {inst.status === 'CERTIFIED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-verified-green">
                          <CheckCircle2 className="w-3 h-3" /> Certified
                        </span>
                      ) : inst.status === 'EXPIRED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" /> Expired
                        </span>
                      ) : inst.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          <Clock className="w-3 h-3" /> In verification
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {inst.validUntil ? formatDate(inst.validUntil) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {inst.status === 'CERTIFIED' && inst.certificatePublicId ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => navigate(`/v/${inst.certificatePublicId}`)}
                          className="text-xs"
                        >
                          View certificate
                        </Button>
                      ) : (
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => navigate(`/dashboard/apply?instrumentId=${inst.id}`)}
                          className="text-xs"
                        >
                          Apply for verification
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Grid: Certificates & Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Certificates Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-nsh-text">Issued certificates</h2>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/search')}>
              Search public
            </Button>
          </div>

          {data.certificates.length === 0 ? (
            <Card className="p-6 text-center border border-dashed border-slate-300 bg-slate-50/50">
              <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-700">No certificates issued yet</div>
              <p className="text-xs text-slate-500 mt-1">
                Completed inspections produce digitally sealed certificates verified by public QR.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.certificates.map(cert => (
                <Card key={cert.public_id} className="p-4 border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900">{cert.public_id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                        cert.status === 'VALID' 
                          ? 'bg-emerald-100 text-verified-green' 
                          : cert.status === 'EXPIRED' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-red-100 text-seal-break-red'
                      }`}>
                        {cert.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {cert.instrument_info} • <span className="font-mono">{cert.instrument_serial}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Valid: {formatDate(cert.valid_from)} – {formatDate(cert.valid_to)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/v/${cert.public_id}`)}
                      className="text-xs px-2.5 py-1"
                      title="View public verification plate"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1 inline" /> View
                    </Button>
                    <a 
                      href={`/api/certificates/${cert.public_id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-medium border border-slate-300 hover:bg-slate-50 px-2.5 py-1.5 rounded text-slate-700 transition-colors"
                      title="Download legal certificate PDF"
                    >
                      <Download className="w-3.5 h-3.5 mr-1 inline" /> PDF
                    </a>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openQrModal(cert.public_id, cert.instrument_info)}
                      className="text-xs px-2 py-1"
                      title="Show verification QR code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Payments Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-heading text-nsh-text">Recent payments</h2>
            <span className="text-xs text-slate-500">Official fee receipts</span>
          </div>

          {data.recentPayments.length === 0 ? (
            <Card className="p-6 text-center border border-dashed border-slate-300 bg-slate-50/50">
              <CreditCard className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-700">No payment records found</div>
              <p className="text-xs text-slate-500 mt-1">
                Receipts are generated instantly upon demo fee settlement.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.recentPayments.map(p => (
                <Card key={p.receipt_id} className="p-4 border border-slate-200 bg-white shadow-sm flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-800">{p.receipt_id}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-verified-green">
                        PAID
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {p.instrument_info} ({p.instrument_serial})
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Paid on {formatDate(p.created_at)}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold font-mono text-slate-900">{formatInr(p.amount)}</div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/dashboard/receipt/${p.application_id}`)}
                      className="text-xs mt-1 px-2.5 py-1 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3 inline" /> Receipt PDF
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {qrModalCert && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl text-center relative">
            <button 
              onClick={closeQrModal}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 transition-colors p-1"
              aria-label="Close QR modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-calibration-blue rounded-full flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold font-heading text-slate-900">Certificate Verification QR</h3>
              <p className="text-xs text-slate-600 mt-1">{qrModalCert.instrumentInfo}</p>
              <p className="font-mono text-xs text-calibration-blue mt-0.5">{qrModalCert.publicId}</p>
            </div>

            {qrDataUrl ? (
              <div className="p-3 bg-slate-50 rounded-lg inline-block border border-slate-200">
                <img src={qrDataUrl} alt="Certificate QR Code" className="w-56 h-56 mx-auto" />
              </div>
            ) : (
              <div className="w-56 h-56 bg-slate-100 flex items-center justify-center mx-auto text-xs text-slate-400">
                Generating QR code...
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed">
              Anyone can scan this code with a mobile camera or verify on the public verification portal.
            </p>

            <div className="pt-2 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/v/${qrModalCert.publicId}`);
                }}
              >
                Copy link
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => navigate(`/v/${qrModalCert.publicId}`)}
              >
                Open page
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
