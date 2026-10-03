import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, AlertCircle, Plus } from 'lucide-react';
import { get } from '../lib/api';
import { formatDate, formatInr } from '../lib/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

interface ApplicationItem {
  id: string;
  instrument_id: string;
  state: string;
  fee_amount: number;
  routing_rule?: string;
  created_at: string;
}

interface InstrumentMap {
  [id: string]: {
    make: string;
    model: string;
    serial: string;
    type_code: string;
  };
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

export function Applications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [instruments, setInstruments] = useState<InstrumentMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      get<ApplicationItem[]>('/api/applications'),
      get<Array<{ id: string; make: string; model: string; serial: string; type_code: string }>>('/api/instruments'),
    ])
      .then(([apps, insts]) => {
        if (Array.isArray(apps)) setApplications(apps);
        if (Array.isArray(insts)) {
          const map: InstrumentMap = {};
          insts.forEach(i => { map[i.id] = i; });
          setInstruments(map);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load applications');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-32 bg-slate-200 rounded-lg"></div>
          <div className="h-32 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Applications"
          description="Manage and track verification applications under Legal Metrology."
        />
        <Button 
          variant="primary" 
          onClick={() => navigate('/dashboard/apply')}
          className="shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> New application
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      {applications.length === 0 ? (
        <Card className="p-12 text-center border border-dashed border-slate-300 bg-white">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800 font-heading">No applications submitted</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Apply for verification of your registered commercial instruments to earn a verified digital seal.
          </p>
          <Button 
            variant="primary" 
            className="mt-5"
            onClick={() => navigate('/dashboard/apply')}
          >
            Start new application
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map(app => {
            const inst = instruments[app.instrument_id];
            const activeStep = getStageIndex(app.state);

            return (
              <Card key={app.id} className="p-6 border border-slate-200 bg-white shadow-sm space-y-4 hover:border-slate-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-calibration-blue">{app.id}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                        app.state === 'CERTIFIED' 
                          ? 'bg-emerald-100 text-verified-green' 
                          : app.state === 'FAILED' 
                            ? 'bg-red-100 text-seal-break-red' 
                            : 'bg-blue-100 text-blue-800'
                      }`}>
                        {app.state}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 mt-1">
                      {inst ? `${inst.make} ${inst.model} (SN: ${inst.serial})` : `Instrument ${app.instrument_id}`}
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-xs text-slate-500">Submitted on {formatDate(app.created_at)}</div>
                    <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                      Fee: {formatInr(app.fee_amount || 0)}
                    </div>
                  </div>
                </div>

                {/* Tick Timeline */}
                <div className="pt-2 max-w-2xl">
                  <div className="relative flex items-center justify-between">
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
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
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
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => navigate(`/dashboard/applications/${app.id}`)}
                    className="text-xs flex items-center gap-1"
                  >
                    View application <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
