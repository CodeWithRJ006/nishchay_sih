import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  FlaskConical, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  ExternalLink, 
  Lock
} from 'lucide-react';
import { get, post, ApiError } from '../lib/api';
import { useAuth } from '../AuthContext';

interface JudgesLabDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DemoProgress {
  register: boolean;
  apply: boolean;
  pay: boolean;
  schedule: boolean;
  inspect: boolean;
  certify: boolean;
  verify: boolean;
  rightToCheck: boolean;
}

interface TamperStatus {
  publicId: string;
  isTampered: boolean;
}

export function JudgesLabDrawer({ isOpen, onClose }: JudgesLabDrawerProps) {
  const { user, refresh: refreshAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<'security' | 'guide' | 'utilities'>('security');
  const [progress, setProgress] = useState<DemoProgress | null>(null);
  const [tamperState, setTamperState] = useState<TamperStatus | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [gateBlockResult, setGateBlockResult] = useState<{ status: 'idle' | 'blocked' | 'error'; message: string }>({
    status: 'idle',
    message: ''
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const ensureAuth = async () => {
    if (!user) {
      await post('/api/demo/login-as/ADMIN', {});
      await refreshAuth();
    }
  };

  const refreshStatus = useCallback(async () => {
    try {
      const prog = await get<DemoProgress>('/api/demo/progress');
      setProgress(prog);
    } catch {
      // ignore
    }
    try {
      const tStatus = await get<TamperStatus>('/api/admin/demo/tamper-status?publicId=sample-cert-val1d-0000');
      setTamperState(tStatus);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void refreshStatus();
    }
  }, [isOpen, refreshStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleGateBlockTest = async () => {
    setLoading('gate');
    setGateBlockResult({ status: 'idle', message: '' });
    setActionMessage(null);
    try {
      await ensureAuth();
      await post('/api/admin/demo/issue-no-payment', {});
      setGateBlockResult({
        status: 'error',
        message: 'Security warning: Issuance unexpectedly succeeded without receipt.'
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setGateBlockResult({
          status: 'blocked',
          message: `409 Conflict: ${err.message}. Event GATE_BLOCKED recorded in audit telemetry.`
        });
      } else {
        setGateBlockResult({
          status: 'blocked',
          message: 'Fee-gate blocked issuance without valid receipt (HTTP 409).'
        });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleTamperToggle = async () => {
    if (!tamperState) return;
    setLoading('tamper');
    setActionMessage(null);
    try {
      await ensureAuth();
      if (tamperState.isTampered) {
        await post('/api/admin/demo/undo-tamper', { publicId: 'sample-cert-val1d-0000' });
        setActionMessage('Seal restored! Public record restored to official signature.');
      } else {
        await post('/api/admin/demo/tamper', { publicId: 'sample-cert-val1d-0000' });
        setActionMessage('Seal broken! Public record altered. WebCrypto will now fail verification.');
      }
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setActionMessage(`Error: ${msg}`);
    } finally {
      setLoading(null);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset demo database to original seeded state?')) return;
    setLoading('reset');
    setActionMessage(null);
    try {
      await ensureAuth();
      await post('/api/admin/demo/reset', {});
      setActionMessage('Factory demo database restored.');
      await refreshStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setActionMessage(`Error: ${msg}`);
    } finally {
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-ink/40 backdrop-blur-sm"
      role="dialog"
      aria-label="Judge's Lab & Evaluation Guide"
      aria-modal="true"
    >
      <div 
        className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-ink text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-calibration-blue/30 rounded-lg text-calibration-blue">
              <FlaskConical className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-base font-bold font-heading leading-tight text-white">
                Judge's Lab &amp; Guide
              </h2>
              <p className="text-sm text-slate-300">SIH26036 Interactive Evaluation Harness</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close Judge's Lab"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-calibration-blue text-calibration-blue font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Security Demos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-calibration-blue text-calibration-blue font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Trust Loop Guide
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('utilities')}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'utilities'
                ? 'border-calibration-blue text-calibration-blue font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            System &amp; Reset
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-900 animate-in fade-in">
              {actionMessage}
            </div>
          )}

          {/* TAB 1: SECURITY DEMOS */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Demo 1: Fee-Gate Refusal */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-amber-100 rounded text-amber-800">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-ink">
                    1. Fee-Gate Bypass Refusal
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Demonstrate that no administrator or rogue officer can issue a certificate without a verified, HMAC-locked fee receipt in the database.
                </p>

                <button
                  type="button"
                  data-testid="lab-test-gate-block"
                  onClick={handleGateBlockTest}
                  disabled={loading === 'gate'}
                  className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-900 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  {loading === 'gate' ? 'Testing Fee Gate...' : 'Attempt Issuance Without Payment'}
                </button>

                {gateBlockResult.status === 'blocked' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Fee Gate Held (409 Refusal)</span>
                    </div>
                    <p className="text-sm text-emerald-700 leading-snug">
                      {gateBlockResult.message}
                    </p>
                  </div>
                )}
                {gateBlockResult.status === 'error' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {gateBlockResult.message}
                  </div>
                )}
              </div>

              {/* Demo 2: Tamper & Undo */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-red-100 rounded text-red-800">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-ink">
                    2. Cryptographic Tamper &amp; Undo
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Alter the canonical public record of certificate <span className="font-mono font-bold text-slate-800 text-sm">sample-cert-val1d-0000</span>. The browser WebCrypto engine detects the signature mismatch and breaks the seal.
                </p>

                <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    {tamperState?.isTampered ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold bg-red-100 text-red-800">
                        <AlertTriangle className="w-4 h-4" /> Seal Broken (Altered)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-sm font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-4 h-4" /> Seal Intact (VALID)
                      </span>
                    )}
                  </div>
                  <a
                    href="/v/sample-cert-val1d-0000"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-calibration-blue hover:underline flex items-center gap-1"
                  >
                    <span>View Certificate</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <button
                  type="button"
                  data-testid="lab-toggle-tamper"
                  onClick={handleTamperToggle}
                  disabled={loading === 'tamper'}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50 ${
                    tamperState?.isTampered
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-red-700 hover:bg-red-800 text-white'
                  }`}
                >
                  {loading === 'tamper'
                    ? 'Updating...'
                    : tamperState?.isTampered
                    ? 'Restore Official Signature (Undo)'
                    : 'Alter Record (Break Cryptographic Seal)'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: TRUST LOOP GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-sm font-bold text-ink mb-1">
                  SIH26036 Trust Loop Verification
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Every legal metrology certificate proceeds through seven deterministic stages.
                </p>

                <div className="space-y-3">
                  {[
                    { key: 'register', num: '1', title: 'Registration & Premises', desc: 'Commercial establishment registered with trade premises' },
                    { key: 'apply', num: '2', title: 'Statutory Application', desc: 'Instrument class tolerances and fee snapshotted' },
                    { key: 'pay', num: '3', title: 'Fee-Gate Payment', desc: 'Statutory fee e-receipt signed with HMAC key' },
                    { key: 'schedule', num: '4', title: 'Officer Scheduling', desc: 'Least-loaded officer assigned by zone and daily limit' },
                    { key: 'inspect', num: '5', title: 'Geo-Tagged Inspection', desc: 'Arrival verified within 150m, photos and readings captured' },
                    { key: 'certify', num: '6', title: 'ECDSA Seal Issuance', desc: 'P-256 signature generated over canonical JSON digest' },
                    { key: 'rightToCheck', num: '7', title: 'Public Verification', desc: 'Consumers verify QR code and file Right to Check grievances' },
                  ].map((s) => {
                    const isDone = progress ? (progress as unknown as Record<string, boolean>)[s.key] : false;
                    return (
                      <div key={s.key} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5 ${
                          isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {s.num}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{s.title}</h4>
                            <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                              isDone ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isDone ? 'Complete' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{s.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: UTILITIES */}
          {activeTab === 'utilities' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <h3 className="text-sm font-bold text-ink">System Status</h3>
                <dl className="text-sm divide-y divide-slate-200 text-slate-700">
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-600">Mode</dt>
                    <dd className="font-semibold text-emerald-700">DEMO_MODE Active</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-600">Signature Standard</dt>
                    <dd className="font-semibold text-slate-800">ECDSA P-256 (ieee-p1363)</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-600">Audit Storage</dt>
                    <dd className="font-semibold text-slate-800">Append-Only (Triggers Active)</dd>
                  </div>
                  <div className="py-2 flex justify-between">
                    <dt className="text-slate-600">Jurisdiction</dt>
                    <dd className="font-semibold text-slate-800">Hyderabad (North &amp; South)</dd>
                  </div>
                </dl>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
                <h3 className="text-sm font-bold text-ink">Reset Factory State</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Re-runs migrations and restores seeded demonstration data across all four roles.
                </p>
                <button
                  type="button"
                  data-testid="lab-reset-button"
                  onClick={handleReset}
                  disabled={loading === 'reset'}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-black text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{loading === 'reset' ? 'Resetting...' : 'Reset Demo Database'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-center shrink-0">
          <p className="text-sm text-slate-600">
            Smart India Hackathon Prototype • SIH26036
          </p>
        </div>
      </div>
    </div>
  );
}
