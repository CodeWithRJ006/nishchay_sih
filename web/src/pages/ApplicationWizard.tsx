import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { get, post, upload } from '../lib/api';
import { formatInr } from '../lib/formatters';
import { DEMO_MODE, nextSeq } from '../lib/demo';
import { Scale, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, Plus } from 'lucide-react';

interface InstrumentItem {
  id: string;
  type_code: string;
  make: string;
  model: string;
  serial: string;
  capacity?: string;
}

const STEPS = [
  { id: 1, label: 'Instrument' },
  { id: 2, label: 'Fee and documents' },
  { id: 3, label: 'Review' },
];

export function ApplicationWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [instruments, setInstruments] = useState<InstrumentItem[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>(searchParams.get('instrumentId') || '');
  
  const [step, setStep] = useState(1);
  const [fee, setFee] = useState(200);
  const [rule, setRule] = useState('Routed to LMO: Standard commercial equipment');
  
  const [docHash, setDocHash] = useState('');
  const [docName, setDocName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [error, setError] = useState('');

  useEffect(() => {
    get<InstrumentItem[]>('/api/instruments')
      .then(data => {
        if (Array.isArray(data)) {
          setInstruments(data);
          const paramId = searchParams.get('instrumentId');
          if (paramId && data.some(i => i.id === paramId)) {
            setSelectedInstId(paramId);
          }
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const fillDemo = () => {
    if (instruments.length > 0) {
      setSelectedInstId(instruments[0].id);
    }
  };

  const registerDemoInstrumentAndContinue = async () => {
    setError('');
    const n = nextSeq();
    try {
      const newInst = await post<{ id: string }>('/api/instruments', {
        type_code: 'W-1',
        make: 'National Weights & Measures',
        model: `Standard-M1-${n}`,
        serial: `SN-DEMO-${Date.now().toString().slice(-6)}`,
        capacity: '10kg',
        accuracy_class: 'M1',
        location: 'Demo Retail Counter',
      });

      if (newInst && newInst.id) {
        setSelectedInstId(newInst.id);
        setFee(100);
        setRule('Routed to LMO: Weights');
        setInstruments(prev => [
          ...prev,
          {
            id: newInst.id,
            type_code: 'W-1',
            make: 'National Weights & Measures',
            model: `Standard-M1-${n}`,
            serial: `SN-DEMO-${Date.now().toString().slice(-6)}`,
            capacity: '10kg',
          }
        ]);
        setStep(2);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create demo instrument');
    }
  };

  const handleNext1 = () => {
    if (!selectedInstId) return;
    const inst = instruments.find(i => i.id === selectedInstId);
    if (inst) {
      if (inst.type_code.includes('NAWI')) {
        setFee(500);
        setRule('Routed to GATC: NAWI class III up to 150 kg');
      } else if (inst.type_code === 'C-1') {
        setFee(150);
        setRule('Routed to LMO: Capacity measure');
      } else if (inst.type_code === 'CM-1') {
        setFee(200);
        setRule('Routed to LMO: Counter machine');
      } else {
        setFee(100);
        setRule(`Routed to LMO: ${inst.type_code === 'L-1' ? 'Length measure' : 'Weights'}`);
      }
    }
    setStep(2);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const f = e.target.files[0];
    
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', f);
    
    try {
      const data = await upload<{ fileName: string; fileHash: string }>('/api/upload', formData);
      setDocName(data.fileName);
      setDocHash(data.fileHash);
    } catch {
      setError('Upload failed. Please ensure file is a JPG, PNG, or PDF under 5MB.');
    } finally {
      setUploading(false);
    }
  };

  const attachDemoDocument = async () => {
    setError('');
    setUploading(true);
    try {
      const demoBlob = new Blob(['%PDF-1.4 Demo Purchase Invoice for Legal Metrology Verification'], { type: 'application/pdf' });
      const demoFile = new File([demoBlob], 'demo-invoice.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('file', demoFile);

      const data = await upload<{ fileName: string; fileHash: string }>('/api/upload', formData);
      setDocName(data.fileName);
      setDocHash(data.fileHash);
    } catch {
      setError('Demo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await post<{ id: string }>('/api/applications', {
        instrument_id: selectedInstId,
        documents: docName ? [{ doc_type: 'INVOICE', file_name: docName, file_hash: docHash }] : [],
      });
      navigate('/dashboard/payment/' + result.id);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Application submission failed. Please verify your instrument status.');
      setSubmitting(false);
    }
  };

  const selectedInst = instruments.find(i => i.id === selectedInstId);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-nsh-text">New Application</h1>
          <p className="text-xs text-slate-500 mt-0.5">Apply for verification and certification under Legal Metrology.</p>
        </div>
        {DEMO_MODE && step === 1 && instruments.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={fillDemo} className="text-xs">
            Fill demo details
          </Button>
        )}
      </div>
      
      {/* 3-Step Stepper with Visible Labels and Visible Active Step */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((s) => {
            const isCurrent = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div 
                key={s.id} 
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex flex-col sm:flex-row items-center gap-2.5 p-2 rounded transition-colors ${
                  isCurrent ? 'bg-blue-50/70 border-b-2 border-calibration-blue' : ''
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isCompleted 
                    ? 'bg-verified-green text-white' 
                    : isCurrent 
                      ? 'bg-calibration-blue text-white ring-4 ring-blue-100' 
                      : 'bg-slate-200 text-slate-600'
                }`}>
                  {isCompleted ? '✓' : s.id}
                </div>
                <div className="text-center sm:text-left">
                  <div className={`text-xs font-bold leading-tight ${
                    isCurrent ? 'text-calibration-blue' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-slate-400 hidden sm:block">
                    {s.id === 1 ? 'Select unit' : s.id === 2 ? 'Documents & fee' : 'Final review'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="text-sm">{error}</div>
        </div>
      )}

      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Step 1: Select Instrument */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-slate-900">Step 1: Select Instrument</h2>
              <p className="text-xs text-slate-500 mt-0.5">Choose the registered instrument you wish to certify.</p>
            </div>

            {instruments.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50 space-y-4">
                <Scale className="w-10 h-10 text-slate-400 mx-auto" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">No instruments registered yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    You must register a weighing or measuring instrument in your profile before applying for certification.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => navigate('/dashboard/instruments')}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Register your first instrument
                  </Button>
                  {DEMO_MODE && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={registerDemoInstrumentAndContinue}
                      className="text-xs"
                    >
                      Register a demo instrument and continue &rarr;
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {instruments.map(i => (
                  <label 
                    key={i.id} 
                    htmlFor={`app-inst-${i.id}`} 
                    className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition-colors ${
                      selectedInstId === i.id 
                        ? 'border-calibration-blue bg-blue-50/60 ring-1 ring-calibration-blue' 
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        id={`app-inst-${i.id}`}
                        name="application_instrument_selection" 
                        autoComplete="off"
                        className="text-calibration-blue focus:ring-calibration-blue" 
                        checked={selectedInstId === i.id} 
                        onChange={() => setSelectedInstId(i.id)} 
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{i.make} {i.model}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Class: <strong>{i.type_code}</strong> • SN: <span className="font-mono">{i.serial}</span>
                          {i.capacity ? ` • Cap: ${i.capacity}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {i.id}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                className="text-xs"
              >
                Cancel
              </Button>
              <div className="flex items-center gap-3">
                {!selectedInstId && instruments.length > 0 && (
                  <span className="text-xs text-slate-500">
                    Select an instrument to continue
                  </span>
                )}
                <Button 
                  onClick={handleNext1} 
                  disabled={!selectedInstId}
                  className="flex items-center gap-1.5"
                >
                  Next step <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Review Routing & Fee, Upload Documents */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-slate-900">Step 2: Fee and documents</h2>
              <p className="text-xs text-slate-500 mt-0.5">Review statutory fee snapshot and attach verification documents.</p>
            </div>

            {selectedInst && (
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Selected instrument:</span>
                  <div className="text-sm font-bold text-slate-900">{selectedInst.make} {selectedInst.model}</div>
                </div>
                <div className="font-mono text-xs text-slate-600">{selectedInst.id}</div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Statutory authority routing:</span>
                <span className="font-semibold text-slate-900">{rule}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2.5">
                <span className="text-slate-600">Verification fee (Demo):</span>
                <span className="font-bold font-mono text-base text-slate-900">{formatInr(fee)}</span>
              </div>
            </div>
            
            <div className="space-y-3 pt-2">
              <label htmlFor="application-doc-upload" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Upload invoice or supporting document (PDF/JPG/PNG, max 5MB)
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input 
                  id="application-doc-upload"
                  name="application_document_file"
                  autoComplete="off"
                  type="file" 
                  accept=".jpg,.png,.pdf" 
                  onChange={handleUpload} 
                  disabled={uploading}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-calibration-blue hover:file:bg-blue-100 cursor-pointer" 
                />
                {DEMO_MODE && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={attachDemoDocument}
                    disabled={uploading}
                    className="shrink-0 text-xs"
                  >
                    Attach demo invoice
                  </Button>
                )}
              </div>

              {uploading && <div className="text-xs text-slate-500">Uploading and hashing file...</div>}
              {docName && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-verified-green" />
                    <span>Attached: <strong className="font-mono">{docName}</strong></span>
                  </div>
                  <span className="text-xs text-emerald-700 font-mono">SHA-256 verified</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div className="flex items-center gap-3">
                {!docName && (
                  <span className="text-xs text-slate-500">
                    Upload a supporting document to continue
                  </span>
                )}
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!docName || uploading}
                  className="flex items-center gap-1.5"
                >
                  Review &amp; submit <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Final Submission */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold font-heading text-slate-900">Step 3: Review</h2>
              <p className="text-xs text-slate-500 mt-0.5">Verify your application details before submission.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Instrument:</span>
                <span className="font-semibold text-slate-900">
                  {selectedInst?.make} {selectedInst?.model} ({selectedInst?.serial})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Class:</span>
                <span className="font-semibold text-slate-900">{selectedInst?.type_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Routing:</span>
                <span className="font-semibold text-slate-900">{rule}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Supporting document:</span>
                <span className="font-mono text-slate-900">{docName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3">
                <span className="text-slate-700 font-semibold">Total statutory fee:</span>
                <span className="font-bold font-mono text-base text-slate-900">{formatInr(fee)}</span>
              </div>
            </div>

            <NextStepBanner 
              title="Ready to submit application?"
              description="Upon submission, a statutory fee record will be snapshotted. You will be directed to settle the demo fee."
              actionLabel={submitting ? "Submitting..." : "Submit Application"}
              onAction={submit}
            />

            <div className="flex items-center justify-between pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setStep(2)}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs"
              >
                <ArrowLeft className="w-4 h-4" /> Back to documents
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
