import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';

interface Certificate {
  id: string;
  public_id: string;
  application_id: string;
  instrument_id: string;
  valid_from: string;
  valid_to: string;
  status: 'VALID' | 'REVOKED' | 'EXPIRED';
  public_record: string;
}

export const PublicVerify = () => {
  const { id } = useParams<{ id: string }>();
  const [cert, setCert] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [complaintMode, setComplaintMode] = useState(false);
  const [complaintText, setComplaintText] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/certificates/${id}`)
      .then(res => res.ok ? res.json() : Promise.reject('Not found'))
      .then(data => {
        setCert(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Certificate not found or invalid.');
        setLoading(false);
      });
  }, [id]);

  const submitComplaint = async () => {
    if (!complaintText) return;
    try {
      const res = await fetch(`/api/certificates/${id}/complaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: complaintText })
      });
      if (res.ok) {
        setComplaintSuccess(true);
        setComplaintMode(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Failed to submit complaint');
      }
    } catch {
      alert('Error connecting to server');
    }
  };

  if (loading) return <div className="p-8 text-center">Verifying digital seal...</div>;

  if (error || !cert) {
    return (
      <div className="min-h-screen bg-gauge-steel flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded shadow-sm border border-red-200 p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ink mb-2">Invalid Certificate</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link to="/">
            <Button variant="outline" className="w-full">Back to Search</Button>
          </Link>
        </div>
      </div>
    );
  }

  let record: Record<string, string | boolean> = {};
  try {
    record = JSON.parse(cert.public_record);
  } catch { /* ignore */ }

  const isTampered = record.tampered === true;
  const isRevoked = cert.status === 'REVOKED';
  const isExpired = new Date(cert.valid_to) < new Date();

  const sealValid = !isTampered && !isRevoked && !isExpired;

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col items-center p-4 pt-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className={`p-6 flex flex-col items-center text-center text-white ${sealValid ? 'bg-green-600' : 'bg-red-600'}`}>
          {sealValid ? (
            <ShieldCheck className="w-20 h-20 mb-4" />
          ) : (
            <ShieldAlert className="w-20 h-20 mb-4" />
          )}
          <h1 className="text-2xl font-bold tracking-wider">
            {sealValid ? 'SEAL VERIFIED' : isTampered ? 'SEAL BROKEN' : isRevoked ? 'CERTIFICATE REVOKED' : 'EXPIRED'}
          </h1>
          <p className="mt-2 opacity-90 font-mono text-sm">{cert.public_id}</p>
        </div>

        <div className="p-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Business Details</h3>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="text-gray-500">Business Name</div>
            <div className="font-semibold text-right">{record.tradeName || 'Unknown'}</div>
            
            <div className="text-gray-500">Instrument Class</div>
            <div className="font-semibold text-right">{record.instrumentClass || 'Unknown'}</div>
            
            <div className="text-gray-500">Serial No</div>
            <div className="font-semibold font-mono text-right">{record.serialNo || 'Unknown'}</div>
          </div>

          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">Validity</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-8">
            <div className="text-gray-500">Issued On</div>
            <div className="font-semibold text-right">{new Date(cert.valid_from).toLocaleDateString()}</div>
            
            <div className="text-gray-500">Valid Until</div>
            <div className="font-semibold text-right">{new Date(cert.valid_to).toLocaleDateString()}</div>
            
            <div className="text-gray-500">Authority</div>
            <div className="font-semibold text-right">{record.authorityName || 'Legal Metrology'}</div>
          </div>

          {complaintSuccess ? (
            <div className="bg-green-50 p-4 rounded text-green-700 text-sm text-center mb-4">
              Your complaint has been recorded for review. Thank you.
            </div>
          ) : complaintMode ? (
            <div className="bg-orange-50 p-4 rounded mb-4">
              <h4 className="font-bold text-sm text-orange-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Report Discrepancy
              </h4>
              <textarea 
                className="w-full text-sm border rounded p-2 mb-2" 
                rows={3} 
                placeholder="Describe what is wrong (e.g. scale shows incorrect weight)..."
                value={complaintText}
                onChange={e => setComplaintText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setComplaintMode(false)}>Cancel</Button>
                <Button variant="danger" className="flex-1" onClick={submitComplaint}>Submit</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <a href={`/api/certificates/${cert.public_id}/pdf`} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> PDF
                </Button>
              </a>
              <Button variant="danger" className="flex-1 flex items-center justify-center gap-2" onClick={() => setComplaintMode(true)}>
                <AlertTriangle className="w-4 h-4" /> Report Issue
              </Button>
            </div>
          )}
        </div>
      </div>
      <Link to="/" className="mt-8 text-sm text-gray-500 hover:underline">Verify another certificate</Link>
    </div>
  );
};
