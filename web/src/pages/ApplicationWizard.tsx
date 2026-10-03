import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { get, post, upload } from '../lib/api';
import { formatInr } from '../lib/formatters';
import { DEMO_MODE } from '../lib/demo';

export function ApplicationWizard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [instruments, setInstruments] = useState<Array<{ id: string, type_code: string, make: string, model: string, serial: string }>>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>(searchParams.get('instrumentId') || '');
  
  const [step, setStep] = useState(1);
  const [fee, setFee] = useState(0);
  const [rule, setRule] = useState('');
  
  const [docHash, setDocHash] = useState('');
  const [docName, setDocName] = useState('');
  
  const [error, setError] = useState('');

  useEffect(() => {
    get<Array<{ id: string, type_code: string, make: string, model: string, serial: string }>>('/api/instruments').then(data => {
      if (Array.isArray(data)) {
        setInstruments(data);
        if (!selectedInstId && data.length > 0) {
          // If instrumentId was passed via search params, prefer that, else can leave unselected
        }
      }
    });
  }, [selectedInstId]);

  const fillDemo = () => {
    if (instruments.length > 0) {
      setSelectedInstId(instruments[0].id);
    }
  };

  const handleNext1 = () => {
    if (!selectedInstId) return;
    const inst = instruments.find(i => i.id === selectedInstId);
    if (inst) {
      if (inst.type_code.includes('NAWI')) {
        setFee(500);
        setRule('Routed to GATC: NAWI class III up to 150 kg');
      } else {
        setFee(200);
        setRule('Routed to LMO: Standard weight');
      }
    }
    setStep(2);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const f = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', f);
    
    try {
      const data = await upload<{ fileName: string; fileHash: string }>('/api/upload', formData);
      setDocName(data.fileName);
      setDocHash(data.fileHash);
    } catch {
      setError('Upload failed. Please ensure file is a JPG, PNG, or PDF under 5MB.');
    }
  };

  const submit = async () => {
    setError('');
    try {
      const result = await post<{ id: string }>('/api/applications', {
        instrument_id: selectedInstId,
        documents: docName ? [{ doc_type: 'INVOICE', file_name: docName, file_hash: docHash }] : [],
      });
      navigate('/dashboard/payment/' + result.id);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Application submission failed. Please verify your instrument status.');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-nsh-text">New Application</h1>
        {DEMO_MODE && step === 1 && (
          <Button type="button" variant="outline" size="sm" onClick={fillDemo} disabled={instruments.length === 0}>
            Fill demo details
          </Button>
        )}
      </div>
      
      {/* Tick scale status tracker */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2"></div>
        <div className={`absolute left-0 top-1/2 h-1 bg-nsh-primary -z-10 -translate-y-1/2 transition-all duration-300`} style={{ width: `${((step - 1) / 2) * 100}%` }}></div>
        
        {[1, 2, 3].map(i => (
          <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= i ? 'bg-nsh-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            {i}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

      <Card>
        {step === 1 && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Step 1: Select Instrument</h2>
            <div className="space-y-2">
              {instruments.map(i => (
                <label key={i.id} htmlFor={`app-inst-${i.id}`} className={`flex items-center p-3 border rounded cursor-pointer ${selectedInstId === i.id ? 'border-nsh-primary bg-blue-50' : 'border-gray-200'}`}>
                  <input 
                    type="radio" 
                    id={`app-inst-${i.id}`}
                    name="application_instrument_selection" 
                    autoComplete="off"
                    className="mr-3" 
                    checked={selectedInstId === i.id} 
                    onChange={() => setSelectedInstId(i.id)} 
                  />
                  <div>
                    <div className="font-medium">{i.make} {i.model}</div>
                    <div className="text-sm text-gray-500">SN: {i.serial}</div>
                  </div>
                </label>
              ))}
              {instruments.length === 0 && (
                <div className="text-sm text-gray-500 py-4">No instruments found. Please register one first.</div>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={handleNext1} disabled={!selectedInstId}>Next &rarr;</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Step 2: Review Routing & Fee</h2>
            <div className="bg-gray-50 p-4 rounded text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Routing:</span>
                <span className="font-medium text-right">{rule}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-500">Fee (Demo):</span>
                <span className="font-medium font-mono text-lg">{formatInr(fee)}</span>
              </div>
            </div>
            
            <div className="pt-4 space-y-2">
              <label htmlFor="application-doc-upload" className="block text-sm font-medium">Upload Invoice / Supporting Doc (PDF/JPG/PNG, max 5MB)</label>
              <input 
                id="application-doc-upload"
                name="application_document_file"
                autoComplete="off"
                type="file" 
                accept=".jpg,.png,.pdf" 
                onChange={handleUpload} 
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-nsh-primary hover:file:bg-blue-100" 
              />
              {docName && <div className="text-sm text-green-600 mt-2">✓ Uploaded securely</div>}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>&larr; Back</Button>
              <Button onClick={() => setStep(3)} disabled={!docName}>Next &rarr;</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Step 3: Submit</h2>
            <NextStepBanner 
              title="Ready to submit?"
              description="By submitting, you agree that the details are correct. A demo fee record will be snapshotted."
              actionLabel="Submit Application"
              onAction={submit}
            />
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>&larr; Back</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
