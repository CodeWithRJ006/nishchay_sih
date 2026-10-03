import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download, 
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { get } from '../lib/api';
import { formatDate, formatInr } from '../lib/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface ApplicationData {
  id: string;
  business_id: string;
  instrument_id: string;
  state: string;
  fee_amount: number;
  routing_rule?: string;
  created_at: string;
  updated_at?: string;
  documents?: Array<{
    id: string;
    doc_type: string;
    file_url: string;
    file_hash?: string;
  }>;
}

interface InstrumentData {
  id: string;
  type_code: string;
  make: string;
  model: string;
  serial: string;
  capacity: string;
  accuracy_class?: string;
  location?: string;
}

const STAGES = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'PAID', label: 'Paid' },
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'INSPECTED_PASS', label: 'Inspected' },
  { key: 'CERTIFIED', label: 'Certified' },
];

function getStageIndex(state: string): number {
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

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [instrument, setInstrument] = useState<InstrumentData | null>(null);
  const [certPublicId, setCertPublicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    
    get<ApplicationData>(`/api/applications/${id}`)
      .then(async app => {
        setApplication(app);
        if (app.instrument_id) {
          try {
            const inst = await get<InstrumentData>(`/api/instruments/${app.instrument_id}`);
            setInstrument(inst);
          } catch {
            // instrument details optional
          }
        }
        if (app.state === 'CERTIFIED') {
          try {
            const certRes = await get<{ results: Array<{ public_id: string; application_id: string }> }>(`/api/certificates/search?instrumentId=${app.instrument_id}`);
            if (certRes.results && certRes.results.length > 0) {
              setCertPublicId(certRes.results[0].public_id);
            }
          } catch {
            // cert search optional
          }
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load application details');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-32 bg-slate-200 rounded-lg"></div>
          <div className="h-48 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div>{error || 'Application not found.'}</div>
        </div>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/applications')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to applications
        </Button>
      </div>
    );
  }

  const activeStep = getStageIndex(application.state);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Back link & Header */}
      <div>
        <button 
          onClick={() => navigate('/dashboard/applications')}
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to applications
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-heading text-nsh-text tracking-tight flex items-center gap-3">
              Application <span className="font-mono text-calibration-blue">{application.id}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Submitted on {formatDate(application.created_at)} • Routing: {application.routing_rule || 'Standard'}
            </p>
          </div>
          <span className={`self-start sm:self-auto text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
            application.state === 'CERTIFIED' 
              ? 'bg-emerald-100 text-verified-green' 
              : application.state === 'FAILED' 
                ? 'bg-red-100 text-seal-break-red' 
                : 'bg-blue-100 text-calibration-blue'
          }`}>
            {application.state}
          </span>
        </div>
      </div>

      {/* Tick-Scale Timeline */}
      <Card className="p-6 bg-white border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Verification progress</h2>
        <div className="relative flex items-center justify-between max-w-2xl mx-auto px-4">
          <div className="absolute left-0 top-3 w-full h-0.5 bg-slate-200 -z-0"></div>
          <div 
            className="absolute left-0 top-3 h-0.5 bg-calibration-blue -z-0 transition-all duration-300" 
            style={{ width: `${(activeStep / (STAGES.length - 1)) * 100}%` }}
          ></div>

          {STAGES.map((s, idx) => {
            const isDone = idx < activeStep;
            const isCurrent = idx === activeStep;
            return (
              <div key={s.key} className="flex flex-col items-center z-10">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone 
                    ? 'bg-verified-green text-white shadow-sm' 
                    : isCurrent 
                      ? 'bg-calibration-blue text-white ring-4 ring-blue-100 shadow' 
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <span className={`text-xs mt-1.5 text-center font-medium ${
                  isCurrent ? 'text-calibration-blue font-bold' : isDone ? 'text-slate-800' : 'text-slate-400'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Dynamic Action Section based on state */}
      <Card className="p-6 border border-slate-200 bg-white shadow-sm space-y-4">
        {application.state === 'SUBMITTED' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-lg">
              <CreditCard className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-amber-900 font-heading">Verification fee payment required</h3>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  The statutory demo fee of <strong>{formatInr(application.fee_amount)}</strong> has been snapshotted for this application. Once settled, you can schedule an appointment for physical inspection.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="primary" 
                onClick={() => navigate(`/dashboard/payment/${application.id}`)}
                className="flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" /> Pay fee ({formatInr(application.fee_amount)})
              </Button>
            </div>
          </div>
        )}

        {application.state === 'PAID' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <Calendar className="w-5 h-5 text-calibration-blue shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-blue-900 font-heading">Payment received — choose inspection slot</h3>
                <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                  Your fee receipt is signed and stored. Please select a convenient working date and time slot for the Legal Metrology Officer or GATC to verify the instrument on site.
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/dashboard/receipt/${application.id}`)}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 inline" /> View payment receipt
              </Button>
              <Button 
                variant="primary" 
                onClick={() => navigate(`/dashboard/schedule/${application.id}`)}
                className="flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" /> Schedule appointment
              </Button>
            </div>
          </div>
        )}

        {application.state === 'SCHEDULED' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <Clock className="w-5 h-5 text-calibration-blue shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-blue-900 font-heading">Inspection appointment scheduled</h3>
                <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                  An officer has been assigned to visit your registered premises. Please ensure the instrument is mounted, zero-balanced, and accessible during the inspection window.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/dashboard/receipt/${application.id}`)}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 inline" /> View receipt
              </Button>
            </div>
          </div>
        )}

        {application.state === 'ACCEPTED' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-verified-green shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-emerald-900 font-heading">Officer confirmed appointment</h3>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  The inspecting officer accepted your schedule request and will conduct on-site verification checks as planned.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/dashboard/receipt/${application.id}`)}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 inline" /> View receipt
              </Button>
            </div>
          </div>
        )}

        {application.state === 'INSPECTED_PASS' && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-verified-green shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-emerald-900 font-heading">Field inspection passed</h3>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Your instrument satisfied all tolerance and physical criteria during testing. The department is issuing the tamper-evident certificate.
              </p>
            </div>
          </div>
        )}

        {application.state === 'CERTIFIED' && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-verified-green shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-emerald-900 font-heading">Certificate issued &amp; sealed</h3>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Verification completed. A digital certificate with a cryptographic seal and public QR verification code is active.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate(`/dashboard/receipt/${application.id}`)}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1 inline" /> Receipt PDF
              </Button>
              {certPublicId ? (
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => navigate(`/v/${certPublicId}`)}
                  className="text-xs"
                >
                  View public certificate &rarr;
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="sm" 
                  onClick={() => navigate('/dashboard/search')}
                  className="text-xs"
                >
                  Search certificate &rarr;
                </Button>
              )}
            </div>
          </div>
        )}

        {application.state === 'FAILED' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-seal-break-red shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-red-900 font-heading">Inspection failed</h3>
              <p className="text-xs text-red-800 mt-1 leading-relaxed">
                The instrument did not meet legal tolerances or physical condition standards. Contact your regional Legal Metrology Office for rectification guidelines.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Instrument Details */}
      {instrument && (
        <Card className="p-6 border border-slate-200 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold font-heading text-slate-900">Instrument details</h2>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/dashboard/instruments/${instrument.id}`)}
              className="text-xs"
            >
              View instrument profile
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Make &amp; Model</div>
              <div className="text-sm font-medium text-slate-900 mt-0.5">{instrument.make} {instrument.model}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Serial number</div>
              <div className="text-sm font-mono font-medium text-slate-900 mt-0.5">{instrument.serial}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Instrument class</div>
              <div className="text-sm font-medium text-slate-900 mt-0.5">{instrument.type_code}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Capacity</div>
              <div className="text-sm font-medium text-slate-900 mt-0.5">{instrument.capacity}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Accuracy class</div>
              <div className="text-sm font-medium text-slate-900 mt-0.5">{instrument.accuracy_class || 'Standard'}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Premises location</div>
              <div className="text-sm font-medium text-slate-900 mt-0.5">{instrument.location || 'On site'}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Supporting Documents */}
      {application.documents && application.documents.length > 0 && (
        <Card className="p-6 border border-slate-200 bg-white shadow-sm space-y-3">
          <h2 className="text-base font-bold font-heading text-slate-900">Uploaded documents</h2>
          <div className="divide-y divide-slate-100">
            {application.documents.map(doc => (
              <div key={doc.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-800">{doc.doc_type}</span>
                  <span className="text-xs text-slate-500 font-mono">({doc.file_url})</span>
                </div>
                <a 
                  href={`/api/documents/${doc.file_url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-calibration-blue hover:underline inline-flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
