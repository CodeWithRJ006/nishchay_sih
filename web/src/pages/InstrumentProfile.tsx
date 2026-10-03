import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { get } from '../lib/api';
import { formatDate, formatInr } from '../lib/formatters';
import { ShieldCheck, FileText, ArrowRight, ExternalLink } from 'lucide-react';

interface Instrument {
  id: string;
  type_code: string;
  make: string;
  model: string;
  capacity: string;
  serial: string;
  accuracy_class?: string;
  location?: string;
  created_at?: string;
}

interface ApplicationSummary {
  id: string;
  instrument_id: string;
  state: string;
  fee_amount: number;
  created_at: string;
}

interface CertificateSummary {
  public_id: string;
  instrument_id: string;
  status: string;
  valid_from: string;
  valid_to: string;
}

export function InstrumentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      get<Instrument>(`/api/instruments/${id}`),
      get<ApplicationSummary[]>('/api/applications').catch(() => [] as ApplicationSummary[]),
      get<{ results: CertificateSummary[] }>(`/api/certificates/search?instrumentId=${id}`).catch(() => ({ results: [] })),
    ])
      .then(([inst, apps, certs]) => {
        setInstrument(inst);
        if (Array.isArray(apps)) {
          setApplications(apps.filter(a => a.instrument_id === id));
        }
        if (certs && Array.isArray(certs.results)) {
          setCertificates(certs.results.filter(c => c.instrument_id === id));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 max-w-3xl mx-auto text-slate-500">Loading instrument profile...</div>;
  if (!instrument || !('id' in instrument)) return <div className="p-6 max-w-3xl mx-auto text-red-500">Instrument not found.</div>;

  const hasActiveApp = applications.some(a => !['CERTIFIED', 'FAILED', 'CANCELLED'].includes(a.state));
  const activeCert = certificates.find(c => c.status === 'VALID');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Instrument Profile"
        description={instrument.id}
        backTo={{ to: '/dashboard/instruments', label: 'Back to Instruments' }}
      />

      <Card className="border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100 font-semibold text-slate-800 flex justify-between items-center">
          <span>Specification details</span>
          <span className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider ${
            activeCert ? 'bg-emerald-100 text-verified-green' : 'bg-slate-100 text-slate-700'
          }`}>
            {activeCert ? 'Certified' : 'Registered'}
          </span>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-slate-500 font-semibold uppercase tracking-wider">Make &amp; Model</div>
            <div className="text-sm font-medium text-slate-900 mt-1">{instrument.make} {instrument.model}</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold uppercase tracking-wider">Serial Number</div>
            <div className="text-sm font-medium text-slate-900 mt-1 font-mono">{instrument.serial}</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold uppercase tracking-wider">Type Code</div>
            <div className="text-sm font-medium text-slate-900 mt-1">{instrument.type_code}</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold uppercase tracking-wider">Capacity</div>
            <div className="text-sm font-medium text-slate-900 mt-1">{instrument.capacity}</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold uppercase tracking-wider">Accuracy Class</div>
            <div className="text-sm font-medium text-slate-900 mt-1">{instrument.accuracy_class || 'Standard'}</div>
          </div>
          <div>
            <div className="text-slate-500 font-semibold uppercase tracking-wider">Location</div>
            <div className="text-sm font-medium text-slate-900 mt-1">{instrument.location || 'On site'}</div>
          </div>
        </div>
      </Card>

      {/* Active Certificate Card if present */}
      {activeCert && (
        <Card className="p-5 border border-emerald-200 bg-emerald-50/50 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-verified-green shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Active Certificate</div>
              <div className="font-mono text-sm font-bold text-slate-900">{activeCert.public_id}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Valid until {formatDate(activeCert.valid_to)}
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/v/${activeCert.public_id}`)}
            className="text-xs bg-white flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View public seal
          </Button>
        </Card>
      )}
      
      {/* Verification History */}
      <Card className="border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="p-4 border-b border-slate-100 font-semibold text-slate-800 flex justify-between items-center">
          <span>Verification history</span>
          {!hasActiveApp && (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => navigate(`/dashboard/apply?instrumentId=${instrument.id}`)}
              className="text-xs"
            >
              Apply for verification
            </Button>
          )}
        </div>

        <div className="p-4">
          {applications.length === 0 ? (
            <div className="text-sm text-slate-500 py-4 text-center">
              No verification applications recorded for this instrument yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {applications.map(app => (
                <div key={app.id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-calibration-blue">{app.id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                          app.state === 'CERTIFIED' 
                            ? 'bg-emerald-100 text-verified-green' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {app.state}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Submitted {formatDate(app.created_at)} • Fee: {formatInr(app.fee_amount || 0)}
                      </div>
                    </div>
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/dashboard/applications/${app.id}`)}
                    className="text-xs flex items-center gap-1"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
