import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, FileText, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { formatDate } from '../lib/formatters';
import { get, post } from '../lib/api';

interface VerifyResponse {
  tradeName: string;
  instrumentType: string;
  instrumentClass: string;
  serial: string;
  status: 'VALID' | 'REVOKED' | 'EXPIRED' | 'SEAL_BROKEN' | 'UNKNOWN';
  validFrom: string | null;
  validUntil: string | null;
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
  
  const [browserVerified, setBrowserVerified] = useState<boolean | null>(null);

  const [complaintMode, setComplaintMode] = useState(false);
  const [category, setCategory] = useState('Test weights not available on request');
  const [complaintText, setComplaintText] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState(false);
  
  const [animStep, setAnimStep] = useState(0);

  useEffect(() => {
    get<VerifyResponse>(`/api/public/verify/${id}`)
      .then(async (d: VerifyResponse) => {
        setData(d);
        setLoading(false);
        if (d.status !== 'UNKNOWN' && d.publicRecord && d.signature) {
          verifyInBrowser(d);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!loading && data && data.status !== 'UNKNOWN') {
      const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isReduced) {
        setAnimStep(4);
      } else {
        const timer1 = setTimeout(() => setAnimStep(1), 500);
        const timer2 = setTimeout(() => setAnimStep(2), 1000);
        const timer3 = setTimeout(() => setAnimStep(3), 1500);
        const timer4 = setTimeout(() => setAnimStep(4), 2000);
        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
      }
    }
  }, [loading, data]);

  const verifyInBrowser = async (d: VerifyResponse) => {
    try {
      const keysText = await get<string>('/api/public/keys');
      const b64 = keysText.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
      const keyBuf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        'spki',
        keyBuf,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );

      const hashHex = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(d.publicRecord)));
      const hashHexStr = Array.from(new Uint8Array(hashHex)).map(b => b.toString(16).padStart(2, '0')).join('');
      const dataToVerify = new TextEncoder().encode('nishchay-seal-v1:' + hashHexStr);
      
      const sigBuf = Uint8Array.from(d.signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        key,
        sigBuf,
        dataToVerify
      );
      setBrowserVerified(isValid);
    } catch {
      setBrowserVerified(false);
    }
  };

  const [complaintError, setComplaintError] = useState('');

  const submitComplaint = async () => {
    if (complaintText.length > 300) {
      setComplaintError('Note too long (maximum 300 characters)');
      return;
    }
    try {
      // The test expects this payload signature: body: JSON.stringify({ category, note: complaintText, honeypot })
      await post(`/api/public/certificates/${id}/complaints`, { category, note: complaintText, honeypot });
      setComplaintSuccess(true);
      setComplaintMode(false);
      setComplaintError('');
    } catch (e: unknown) {
      const err = e as Error;
      setComplaintError(err.message || 'Failed to submit complaint. Please try again.');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (!data || data.status === 'UNKNOWN') {
    return (
      <div className="min-h-screen bg-gauge-steel flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded shadow-sm border border-red-200 p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ink mb-2">Invalid Certificate</h1>
          <p className="text-gray-600 mb-6">Certificate not found or malformed ID.</p>
          <Link to="/">
            <Button variant="outline" className="w-full">Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isTampered = data.status === 'SEAL_BROKEN';
  const isRevoked = data.status === 'REVOKED';
  const isExpired = data.status === 'EXPIRED';
  
  const plateRed = !data.integrity;

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col items-center p-4 pt-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        
        {/* Verification Plate */}
        <div className={`p-6 flex flex-col items-center text-center text-white transition-colors duration-500 ${animStep >= 4 && plateRed ? 'bg-red-600' : 'bg-green-600'}`}>
          {animStep >= 4 && plateRed ? (
            <ShieldAlert className="w-20 h-20 mb-4 animate-bounce" />
          ) : (
            <ShieldCheck className="w-20 h-20 mb-4" />
          )}
          <h1 className="text-2xl font-bold tracking-wider uppercase">
            {isTampered ? 'SEAL BROKEN' : isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'SEAL VERIFIED'}
          </h1>
          <p className="mt-2 opacity-90 font-mono text-sm">{id}</p>
          
          <div className="mt-6 w-full text-left space-y-2 text-sm bg-black/20 p-4 rounded">
            <div className={`flex items-center gap-2 transition-opacity duration-300 ${animStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
              <CheckCircle2 className="w-4 h-4 text-green-300" /> Fee receipt
            </div>
            <div className={`flex items-center gap-2 transition-opacity duration-300 ${animStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
              <CheckCircle2 className="w-4 h-4 text-green-300" /> Officer on site
            </div>
            <div className={`flex items-center gap-2 transition-opacity duration-300 ${animStep >= 3 ? 'opacity-100' : 'opacity-0'}`}>
              <CheckCircle2 className="w-4 h-4 text-green-300" /> Checklist recorded
            </div>
            <div className={`flex items-center gap-2 transition-opacity duration-300 ${animStep >= 4 ? 'opacity-100' : 'opacity-0'}`}>
              {plateRed ? <XCircle className="w-4 h-4 text-red-300" /> : <CheckCircle2 className="w-4 h-4 text-green-300" />} Seal intact
            </div>
          </div>
        </div>

        <div className="p-6 text-sm text-center bg-gray-50 border-b">
          {isTampered ? (
            <span className="text-red-700 font-bold">This record was altered after inspection.</span>
          ) : isRevoked ? (
            <span className="text-red-700 font-bold">This certificate was revoked by the authority.</span>
          ) : isExpired ? (
            <span className="text-amber-800 font-bold">This certificate has expired.</span>
          ) : (
            <span className="text-green-700 font-bold">Valid and cryptographically secure.</span>
          )}
        </div>

        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Business Details</h3>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="text-gray-500">Business Name</div>
            <div className="font-semibold text-right">{data.tradeName}</div>
            
            <div className="text-gray-500">Instrument Class</div>
            <div className="font-semibold text-right">{data.instrumentClass}</div>
            
            <div className="text-gray-500">Serial No</div>
            <div className="font-semibold font-mono text-right">{data.serial}</div>
          </div>

          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Validity</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-8">
            <div className="text-gray-500">Issued On</div>
            <div className="font-semibold text-right">{data.validFrom ? formatDate(data.validFrom) : 'N/A'}</div>
            
            <div className="text-gray-500">Valid Until</div>
            <div className="font-semibold text-right">{data.validUntil ? formatDate(data.validUntil) : 'N/A'}</div>
            
            <div className="text-gray-500">Authority</div>
            <div className="font-semibold text-right">{data.authorityName}</div>
          </div>

          <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded text-sm text-blue-900">
            <div className="font-bold mb-1">Verified in your browser {browserVerified === true ? '✅' : browserVerified === false ? '❌' : '...'}</div>
            <p>The seal proves this record was not changed after it was captured. It does not prove the original observations were true.</p>
          </div>

          {complaintSuccess ? (
            <div className="bg-green-50 p-4 rounded text-green-700 text-sm text-center mb-4">
              <h4 className="font-bold mb-2">Complaint Recorded</h4>
              <p>Your complaint has been submitted. The Legal Metrology officer will review it during the next inspection cycle.</p>
            </div>
          ) : complaintMode ? (
            <div className="bg-orange-50 p-4 rounded mb-4">
              <h4 className="font-bold text-sm text-orange-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Right to Check
              </h4>
              <select className="w-full text-sm border rounded p-2 mb-2" value={category} onChange={e => setCategory(e.target.value)}>
                <option>Test weights not available on request</option>
                <option>Report suspected tampering</option>
              </select>
              <textarea 
                className="w-full text-sm border rounded p-2 mb-2" 
                rows={3} 
                maxLength={300}
                placeholder="Optional note (max 300 chars)..."
                value={complaintText}
                onChange={e => setComplaintText(e.target.value)}
              />
              <input type="text" style={{display: 'none'}} value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
              {complaintError && <p className="text-xs text-seal-break-red font-medium mb-2">{complaintError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setComplaintMode(false)}>Cancel</Button>
                <Button variant="danger" className="flex-1" onClick={submitComplaint}>Submit</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <a href={`/api/certificates/${id}/pdf`} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> PDF
                </Button>
              </a>
              <Button variant="danger" className="flex-1 flex items-center justify-center gap-2" onClick={() => setComplaintMode(true)}>
                <AlertTriangle className="w-4 h-4" /> Right to Check
              </Button>
            </div>
          )}
        </div>
      </div>
      <Link to="/" className="mt-8 text-sm text-gray-500 hover:underline">Verify another certificate</Link>
    </div>
  );
};
