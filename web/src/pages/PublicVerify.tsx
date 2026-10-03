import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Ban, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  ArrowLeft 
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { formatDate } from '../lib/formatters';
import { get, post } from '../lib/api';
import { verifySealResult, SealVerificationState } from '../../../shared/src/seal-browser';

interface VerifyResponse {
  tradeName: string;
  instrumentType: string;
  instrumentClass: string;
  serial: string;
  status: 'VALID' | 'REVOKED' | 'EXPIRED' | 'SEAL_BROKEN' | 'UNKNOWN';
  validFrom: string | null;
  validUntil: string | null;
  revokedAt: string | null;
  authorityName: string;
  integrity: boolean;
  ticks: {
    feeReceipt: boolean;
    officerOnSite: boolean;
    checklistRecorded: boolean;
    sealIntact: boolean;
  };
  publicRecord: Record<string, unknown>;
  signature: string;
  keyId: string;
}

export const PublicVerify = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [browserVerification, setBrowserVerification] = useState<{
    state: SealVerificationState;
    reason?: string;
  }>({ state: 'checking' });

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [complaintMode, setComplaintMode] = useState(false);
  const [category, setCategory] = useState('Test weights not available on request');
  const [complaintText, setComplaintText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState(false);
  const [complaintError, setComplaintError] = useState('');
  
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    get<VerifyResponse>(`/api/public/verify/${id}`)
      .then(async (d: VerifyResponse) => {
        setData(d);
        setLoading(false);
        if (d.status !== 'UNKNOWN' && d.publicRecord && d.signature) {
          verifyInBrowser(d);
        } else {
          setBrowserVerification({ state: 'unavailable', reason: 'Record or signature missing.' });
        }
      })
      .catch(() => {
        setLoading(false);
        setBrowserVerification({ state: 'unavailable', reason: 'Failed to load certificate record.' });
      });
  }, [id]);

  useEffect(() => {
    if (!loading && data && data.status !== 'UNKNOWN') {
      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isReduced) {
        setAnimStep(4);
      } else {
        const timer1 = setTimeout(() => setAnimStep(1), 300);
        const timer2 = setTimeout(() => setAnimStep(2), 600);
        const timer3 = setTimeout(() => setAnimStep(3), 900);
        const timer4 = setTimeout(() => setAnimStep(4), 1200);
        return () => { 
          clearTimeout(timer1); 
          clearTimeout(timer2); 
          clearTimeout(timer3); 
          clearTimeout(timer4); 
        };
      }
    }
  }, [loading, data]);

  const verifyInBrowser = async (d: VerifyResponse) => {
    try {
      setBrowserVerification({ state: 'checking' });
      const keysRes = await get<{ publicKeySpkiHex: string }>('/api/public/keys');
      const result = await verifySealResult(d.publicRecord, d.signature, keysRes.publicKeySpkiHex);
      setBrowserVerification(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve verification keys';
      setBrowserVerification({ state: 'unavailable', reason: msg });
    }
  };

  const handleCopyCode = () => {
    if (id) {
      navigator.clipboard.writeText(id).catch(() => {});
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const submitComplaint = async () => {
    if (complaintText.length > 300) {
      setComplaintError('Note too long (maximum 300 characters)');
      return;
    }
    try {
      // Contract test string match: body: JSON.stringify({ category, note: complaintText, honeypot })
      await post(`/api/public/certificates/${id}/complaints`, { category, note: complaintText, honeypot });
      setComplaintSuccess(true);
      setComplaintMode(false);
      setComplaintError('');
    } catch (e: unknown) {
      const err = e as Error;
      setComplaintError(err.message || 'Failed to submit complaint. Please try again.');
    }
  };

  // Chrome Header
  const publicHeader = (
    <header className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-calibration-blue flex items-center justify-center text-white font-bold text-lg font-heading">
            N
          </div>
          <div>
            <span className="font-heading font-bold text-ink text-lg tracking-tight">NISHCHAY</span>
            <span className="hidden sm:inline-block ml-2 text-xs text-gray-500 font-sans">Legal Metrology Verification</span>
          </div>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link to="/" className="text-gray-600 hover:text-ink transition-colors">Home</Link>
          <Link to={id ? `/v/${id}` : '/'} className="text-calibration-blue font-semibold">Verify</Link>
          <Link to="/login" className="text-gray-600 hover:text-ink transition-colors">Sign in</Link>
        </nav>
      </div>
    </header>
  );

  // Chrome Footer
  const publicFooter = (
    <footer className="w-full mt-12 py-6 border-t border-gray-200 bg-white text-center text-xs text-gray-500">
      <div className="max-w-7xl mx-auto px-4 space-y-1">
        <p className="font-medium">Prototype built for SIH26036. Not an official government system.</p>
        <p>All data synthetic. Verified under the Legal Metrology (General) Rules.</p>
      </div>
    </footer>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gauge-steel flex flex-col justify-between">
        {publicHeader}
        <main className="max-w-2xl w-full mx-auto p-4 flex flex-col items-center">
          <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 animate-pulse mx-auto" />
            <div className="h-6 w-48 bg-gray-200 animate-pulse mx-auto rounded" />
            <div className="h-4 w-64 bg-gray-200 animate-pulse mx-auto rounded" />
          </div>
        </main>
        {publicFooter}
      </div>
    );
  }

  if (!data || data.status === 'UNKNOWN') {
    return (
      <div className="min-h-screen bg-gauge-steel flex flex-col justify-between">
        {publicHeader}
        <main className="max-w-md w-full mx-auto p-4 my-auto">
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 text-center">
            <ShieldAlert className="w-16 h-16 text-seal-break-red mx-auto mb-4" />
            <h1 className="text-2xl font-bold font-heading text-ink mb-2">Invalid Certificate</h1>
            <p className="text-gray-600 text-sm mb-6">The requested certificate ID could not be found or is malformed.</p>
            <Link to="/">
              <Button variant="outline" className="w-full">Back to Home</Button>
            </Link>
          </div>
        </main>
        {publicFooter}
      </div>
    );
  }

  const isTampered = data.status === 'SEAL_BROKEN';
  const isRevoked = data.status === 'REVOKED';
  const isExpired = data.status === 'EXPIRED';
  
  const plateRed = !data.integrity || isTampered;

  // Validity timeline calculation
  const now = Date.now();
  const startTime = data.validFrom ? new Date(data.validFrom).getTime() : now;
  const endTime = data.validUntil ? new Date(data.validUntil).getTime() : now;
  const totalDuration = Math.max(1, endTime - startTime);
  const elapsed = Math.max(0, now - startTime);
  const progressRatio = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col justify-between">
      {publicHeader}

      <main className="max-w-2xl w-full mx-auto px-4 py-6">
        {/* Navigation Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-calibration-blue hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Verify another certificate
          </Link>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyCode} 
              className="text-xs flex items-center gap-1.5"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-verified-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied code' : 'Copy code'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyLink} 
              className="text-xs flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-verified-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied link' : 'Copy link'}
            </Button>
          </div>
        </div>

        {/* Certificate Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          
          {/* Verification Plate */}
          <div className={`p-6 flex flex-col items-center text-center text-white transition-colors duration-500 ${
            animStep >= 4 && plateRed 
              ? 'bg-seal-break-red' 
              : isRevoked 
                ? 'bg-seal-break-red' 
                : isExpired 
                  ? 'bg-amber-600' 
                  : 'bg-emerald-600'
          }`}>
            {isTampered ? (
              <ShieldAlert className="w-16 h-16 mb-3 animate-bounce" />
            ) : isRevoked ? (
              <Ban className="w-16 h-16 mb-3" />
            ) : isExpired ? (
              <Clock className="w-16 h-16 mb-3" />
            ) : (
              <ShieldCheck className="w-16 h-16 mb-3" />
            )}

            <h1 className="text-2xl font-bold font-heading tracking-wider uppercase">
              {isTampered ? 'SEAL BROKEN' : isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'VALID'}
            </h1>
            <p className="mt-1 opacity-90 font-mono text-sm tracking-wide">{id}</p>
            
            {/* 4 Ticks derived from real data with sequential lighting */}
            <div className="mt-6 w-full text-left space-y-3 bg-black/25 p-4 rounded-lg text-sm">
              <div className={`flex items-start gap-3 transition-opacity duration-300 ${animStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                {data.ticks.feeReceipt ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">Fee receipt</div>
                  <div className="text-xs text-white/80">Official fee paid and cryptographically signed before scheduling.</div>
                </div>
              </div>

              <div className={`flex items-start gap-3 transition-opacity duration-300 ${animStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                {data.ticks.officerOnSite ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">Officer on site</div>
                  <div className="text-xs text-white/80">Officer GPS coordinates recorded within verified premises radius.</div>
                </div>
              </div>

              <div className={`flex items-start gap-3 transition-opacity duration-300 ${animStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                {data.ticks.checklistRecorded ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">Checklist recorded</div>
                  <div className="text-xs text-white/80">Physical inspection criteria and metric readings permanently stored.</div>
                </div>
              </div>

              <div className={`flex items-start gap-3 transition-opacity duration-300 ${animStep >= 4 ? 'opacity-100' : 'opacity-40'}`}>
                {data.ticks.sealIntact ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">Seal intact</div>
                  <div className="text-xs text-white/80">Cryptographic hash matches all inspection records and photos.</div>
                </div>
              </div>
            </div>
          </div>

          {/* Status Banner Message */}
          <div className={`p-4 text-sm text-center border-b font-medium ${
            isTampered 
              ? 'bg-red-50 text-seal-break-red border-red-200' 
              : isRevoked 
                ? 'bg-red-50 text-seal-break-red border-red-200' 
                : isExpired 
                  ? 'bg-amber-50 text-[#8A5A00] border-amber-200' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {isTampered ? (
              <span>This record was altered after inspection.</span>
            ) : isRevoked ? (
              <span>
                Revoked by the authority on {data.revokedAt ? formatDate(data.revokedAt) : (data.validFrom ? formatDate(data.validFrom) : 'record date')}. Do not rely on this certificate.
              </span>
            ) : isExpired ? (
              <span>
                This certificate expired on {data.validUntil ? formatDate(data.validUntil) : 'expiry date'}. The instrument must be re-verified before it is used for trade.
              </span>
            ) : (
              <span>Valid and cryptographically secure.</span>
            )}
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-6">
            
            {/* Business & Instrument Details */}
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
                Business &amp; Instrument
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Business Name</dt>
                  <dd className="font-semibold text-ink">{data.tradeName}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Instrument Class</dt>
                  <dd className="font-semibold text-ink">{data.instrumentClass}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Serial Number</dt>
                  <dd className="font-semibold font-mono text-ink">{data.serial}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Issuing Authority</dt>
                  <dd className="font-semibold text-ink">{data.authorityName}</dd>
                </div>
              </dl>
            </div>

            {/* Validity Timeline Bar in Tick-Scale Style */}
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100">
                Validity Timeline
              </h2>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2">
                <div className="flex justify-between items-center text-xs text-gray-600 font-medium">
                  <span>Issued: {data.validFrom ? formatDate(data.validFrom) : 'N/A'}</span>
                  <span>Expires: {data.validUntil ? formatDate(data.validUntil) : 'N/A'}</span>
                </div>

                {/* Progress bar track with measurement tick marks */}
                <div className="relative pt-2 pb-1">
                  <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isRevoked ? 'bg-seal-break-red' : isExpired ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${progressRatio}%` }}
                    />
                  </div>

                  {/* Measurement tick marks */}
                  <div className="flex justify-between px-0.5 mt-1 text-[10px] text-gray-400 font-mono select-none">
                    <span>|</span>
                    <span>|</span>
                    <span>|</span>
                    <span>|</span>
                    <span>|</span>
                  </div>
                </div>

                {/* Today marker label */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-700">Today:</span>
                    <span className="text-gray-600">{formatDate(new Date().toISOString())}</span>
                  </div>
                  <div>
                    {isRevoked ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-seal-break-red">
                        Revoked on {data.revokedAt ? formatDate(data.revokedAt) : 'record'}
                      </span>
                    ) : isExpired ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-[#8A5A00]">
                        Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        Active ({100 - progressRatio}% remaining)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Browser Verification Panel */}
            <div className="p-4 bg-calibration-blue/5 border border-calibration-blue/20 rounded-lg text-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-ink">
                  {browserVerification.state === 'checking' && (
                    <>
                      <div className="w-4 h-4 border-2 border-calibration-blue border-t-transparent rounded-full animate-spin" />
                      <span>Verifying seal in your browser...</span>
                    </>
                  )}
                  {browserVerification.state === 'verified' && (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="text-emerald-800">Verified in your browser</span>
                    </>
                  )}
                  {browserVerification.state === 'failed' && (
                    <>
                      <XCircle className="w-5 h-5 text-seal-break-red shrink-0" />
                      <span className="text-seal-break-red">Verification failed</span>
                    </>
                  )}
                  {browserVerification.state === 'unavailable' && (
                    <>
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <span className="text-amber-800">Browser verification unavailable</span>
                    </>
                  )}
                </div>
                {data.keyId && (
                  <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
                    Key: {data.keyId}
                  </span>
                )}
              </div>

              {browserVerification.state === 'failed' && browserVerification.reason && (
                <p className="text-xs text-seal-break-red font-medium mb-2 bg-red-50 p-2 rounded border border-red-100">
                  {browserVerification.reason}
                </p>
              )}

              {browserVerification.state === 'unavailable' && browserVerification.reason && (
                <p className="text-xs text-amber-800 font-medium mb-2 bg-amber-50 p-2 rounded border border-amber-100">
                  {browserVerification.reason}
                </p>
              )}

              <p className="text-xs text-gray-600 leading-relaxed">
                The seal proves this record was not changed after it was captured. It does not prove the original observations were true.
              </p>
            </div>

            {/* Right to Check & Complaint Section */}
            {complaintSuccess ? (
              <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-lg text-emerald-900 text-sm">
                <div className="flex items-center gap-2 font-bold mb-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5" />
                  Complaint Recorded
                </div>
                <p className="text-xs leading-relaxed mb-3">
                  Your complaint has been submitted. The Legal Metrology authority will review this during the next inspection cycle. Inspection records and certificate status remain publicly verifiable.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs bg-white" 
                  onClick={() => { setComplaintSuccess(false); setComplaintText(''); }}
                >
                  Submit another note
                </Button>
              </div>
            ) : complaintMode ? (
              <div className="bg-orange-50/70 border border-orange-200 p-5 rounded-lg space-y-3">
                <h3 className="font-bold text-sm text-orange-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" /> 
                  Right to Check
                </h3>
                <p className="text-xs text-orange-800">
                  Consumers and merchants can report discrepancies with verified equipment directly to Legal Metrology authorities.
                </p>

                <div>
                  <label htmlFor="complaint-category" className="block text-xs font-semibold text-gray-700 mb-1">
                    Category
                  </label>
                  <select 
                    id="complaint-category"
                    name="category"
                    autoComplete="off"
                    className="w-full text-sm border border-gray-300 rounded p-2 bg-white" 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option>Test weights not available on request</option>
                    <option>Report suspected tampering</option>
                    <option>Expired stamp in use</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="complaint-note" className="block text-xs font-semibold text-gray-700 mb-1">
                    Details (max 300 characters)
                  </label>
                  <textarea 
                    id="complaint-note"
                    name="note"
                    autoComplete="off"
                    className="w-full text-sm border border-gray-300 rounded p-2 bg-white focus:ring-1 focus:ring-calibration-blue" 
                    rows={3} 
                    maxLength={300}
                    placeholder="Provide location details or reason for inquiry..."
                    value={complaintText}
                    onChange={e => setComplaintText(e.target.value)}
                  />
                  <div className="text-[10px] text-gray-500 text-right">{complaintText.length}/300</div>
                </div>

                <input 
                  type="text" 
                  style={{ display: 'none' }} 
                  value={honeypot} 
                  onChange={e => setHoneypot(e.target.value)} 
                  tabIndex={-1} 
                  autoComplete="off" 
                />

                {complaintError && (
                  <p role="alert" className="text-xs text-seal-break-red font-medium">
                    {complaintError}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <Button 
                    type="button"
                    variant="outline" 
                    className="flex-1 text-xs" 
                    onClick={() => { setComplaintMode(false); setComplaintError(''); }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    variant="danger" 
                    className="flex-1 text-xs" 
                    onClick={submitComplaint}
                  >
                    Submit Report
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a 
                  href={`/api/certificates/${id}/pdf`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1"
                >
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                    <FileText className="w-4 h-4" /> 
                    Download PDF Certificate
                  </Button>
                </a>
                <Button 
                  variant="danger" 
                  className="flex-1 flex items-center justify-center gap-2" 
                  onClick={() => setComplaintMode(true)}
                >
                  <AlertTriangle className="w-4 h-4" /> 
                  Right to Check
                </Button>
              </div>
            )}

          </div>
        </div>
      </main>

      {publicFooter}
    </div>
  );
};
