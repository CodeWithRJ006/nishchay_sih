import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { CameraCapture } from './CameraCapture';
import { INSTRUMENT_RULES, evaluateReadings } from '../../../../shared/src/rules';

interface PhotoRecord {
  blob: Blob;
  hash: string;
  time: string;
  previewUrl: string;
}

export function JobInspection() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Job metadata (mocked loading, we'd typically fetch this but let's assume we fetch minimum needed)
  const [_instrumentId, setInstrumentId] = useState<string>('NSH-I-000001'); // In real app, fetch this.
  const [instrumentCode, setInstrumentCode] = useState<string>('W-1'); 

  useEffect(() => {
    fetch('/api/appointments/my-jobs')
      .then(r => r.json())
      .then((jobs: { application_id: string, instrument_id: string }[]) => {
        const j = jobs.find(x => x.application_id === id);
        if (j) {
          setInstrumentId(j.instrument_id);
          // Normally we'd need to know the instrument code for checklist. We will default to W-1 if not fetched.
          // Since the API only returns instrument_id, we need a way to get the class.
          // We can fetch the application or instrument.
          fetch(`/api/instruments/${j.instrument_id}`)
            .then(r => r.json())
            .then((inst: { type: string }) => {
               if (inst.type) {
                 const match = INSTRUMENT_RULES.find(r => r.label === inst.type);
                 if (match) setInstrumentCode(match.code);
               }
            });
        }
      });
  }, [id]);

  const rule = INSTRUMENT_RULES.find(r => r.code === instrumentCode)!;

  // Step 1: Photos
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);

  // Step 2: Checklist
  const [checklistValues, setChecklistValues] = useState<Record<number, boolean>>({});

  // Step 3: Readings
  const [readings, setReadings] = useState<{applied: string, observed: string}[]>([{applied: '', observed: ''}]);

  // Step 4: Verdict
  const [pass, setPass] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');

  const handleCapture = (blob: Blob, hash: string, time: string) => {
    const previewUrl = URL.createObjectURL(blob);
    setPhotos([...photos, { blob, hash, time, previewUrl }]);
  };

  const removePhoto = (idx: number) => {
    const newPhotos = [...photos];
    URL.revokeObjectURL(newPhotos[idx].previewUrl);
    newPhotos.splice(idx, 1);
    setPhotos(newPhotos);
  };

  const allChecklistAnswered = rule?.checklistDemo ? Object.keys(checklistValues).length === rule.checklistDemo.length : true;

  const validReadings = readings.filter(r => r.applied !== '' && r.observed !== '').map(r => ({ applied: parseFloat(r.applied), observed: parseFloat(r.observed) }));
  const evaluated = evaluateReadings(instrumentCode, validReadings);

  const handleSubmit = async () => {
    setError('');
    
    if (pass === false && !reason) {
      setError('FAIL needs at least one reason.');
      return;
    }
    if (!evaluated.pass && pass === true && !reason) {
      setError('A PASS when the computed result is FAIL needs a written override reason.');
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    // JSON fields
    const checklistAnswers = rule.checklistDemo?.map((_, i) => checklistValues[i]) || [];
    formData.append('checklist', JSON.stringify(checklistAnswers));
    formData.append('readings', JSON.stringify(validReadings));
    formData.append('pass', JSON.stringify(pass));
    formData.append('reasons', JSON.stringify(reason ? [reason] : []));
    formData.append('clientCaptureTimes', JSON.stringify(photos.map(p => p.time)));
    formData.append('clientHashes', JSON.stringify(photos.map(p => p.hash)));

    photos.forEach(p => formData.append('files', p.blob));

    try {
      const res = await fetch(`/api/field/jobs/${id}/inspection`, {
        method: 'POST',
        headers: { 'x-csrf-token': 'dummy' }, // No content-type so fetch sets multipart/form-data boundary
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submit failed');
      }
      if (pass) {
        alert('Inspection passed. Certificate issue is the next step.');
      } else {
        alert('Inspection failed.');
      }
      navigate('/field');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative pb-24">
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0 flex gap-2">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${step >= s ? 'bg-primary-600' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="p-4 flex-1">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold font-heading">Capture Evidence</h2>
            <p className="text-slate-600 text-sm mb-4">At least 2 photos required.</p>
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.map((p, idx) => (
                <div key={idx} className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 border-primary-500">
                  <img src={p.previewUrl} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">X</button>
                </div>
              ))}
            </div>

            <CameraCapture onCapture={handleCapture} />

            {photos.length >= 2 && (
              <Button variant="primary" className="w-full mt-4 h-12" onClick={() => setStep(2)}>Continue to Checklist</Button>
            )}
          </div>
        )}

        {step === 2 && rule && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold font-heading">Inspection Checklist</h2>
            <div className="space-y-4">
              {rule.checklistDemo?.map((item, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-3">
                  <p className="font-bold text-slate-800">{item}</p>
                  <div className="flex gap-2 h-12">
                    <button 
                      className={`flex-1 rounded font-bold ${checklistValues[idx] === true ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                      onClick={() => setChecklistValues({ ...checklistValues, [idx]: true })}
                    >
                      Yes
                    </button>
                    <button 
                      className={`flex-1 rounded font-bold ${checklistValues[idx] === false ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                      onClick={() => setChecklistValues({ ...checklistValues, [idx]: false })}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="primary" className="w-full h-12 mt-4" disabled={!allChecklistAnswered} onClick={() => setStep(3)}>Continue to Readings</Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold font-heading">Load Test Readings</h2>
            <p className="text-sm text-slate-600">Tolerance: ±{rule.tolerancesDemo}</p>
            
            {readings.map((r, idx) => {
               const applied = parseFloat(r.applied);
               const observed = parseFloat(r.observed);
               const errorVal = isNaN(applied) || isNaN(observed) ? null : Math.abs(applied - observed);
               const isPass = errorVal !== null && errorVal <= rule.tolerancesDemo;

               return (
                <div key={idx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-700">Test Point {idx + 1}</h4>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Applied</label>
                      <input type="number" value={r.applied} onChange={e => {
                        const newR = [...readings];
                        newR[idx].applied = e.target.value;
                        setReadings(newR);
                      }} className="w-full border p-2 rounded text-lg" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Observed</label>
                      <input type="number" value={r.observed} onChange={e => {
                        const newR = [...readings];
                        newR[idx].observed = e.target.value;
                        setReadings(newR);
                      }} className="w-full border p-2 rounded text-lg" />
                    </div>
                  </div>
                  {errorVal !== null && (
                    <div className={`p-2 rounded font-bold text-sm text-center ${isPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      Error: {errorVal} ({isPass ? 'PASS' : 'FAIL'})
                    </div>
                  )}
                </div>
               );
            })}

            <Button variant="outline" className="w-full" onClick={() => setReadings([...readings, {applied: '', observed: ''}])}>+ Add Test Point</Button>

            <Button variant="primary" className="w-full h-12" onClick={() => setStep(4)} disabled={validReadings.length === 0}>Review Verdict</Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold font-heading">Final Verdict</h2>
            
            <div className={`p-6 rounded-lg text-center ${evaluated.pass ? 'bg-green-100 text-green-800 border-2 border-green-500' : 'bg-red-100 text-red-800 border-2 border-red-500'}`}>
              <p className="text-sm uppercase font-bold mb-2">Computed Suggestion</p>
              <h3 className="text-3xl font-black">{evaluated.pass ? 'PASS' : 'FAIL'}</h3>
              {!evaluated.pass && (
                <ul className="mt-2 text-sm text-left list-disc pl-4 text-red-700 font-medium">
                  {evaluated.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <p className="font-bold text-slate-800">Confirm Verdict</p>
              <div className="flex gap-4">
                <button 
                  className={`flex-1 h-14 rounded-lg font-bold text-lg border-2 ${pass === true ? 'bg-green-500 text-white border-green-600' : 'bg-white text-green-600 border-green-200 hover:border-green-400'}`}
                  onClick={() => setPass(true)}
                >
                  PASS
                </button>
                <button 
                  className={`flex-1 h-14 rounded-lg font-bold text-lg border-2 ${pass === false ? 'bg-red-500 text-white border-red-600' : 'bg-white text-red-600 border-red-200 hover:border-red-400'}`}
                  onClick={() => setPass(false)}
                >
                  FAIL
                </button>
              </div>

              {(pass === false || (!evaluated.pass && pass === true)) && (
                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-2">
                    {pass === false ? 'Reason for failure (Required)' : 'Reason for PASS override (Required)'}
                  </label>
                  <textarea 
                    className="w-full border-2 border-slate-300 rounded p-3 h-24" 
                    value={reason} 
                    onChange={e => setReason(e.target.value)}
                    placeholder="Enter details here..."
                  />
                </div>
              )}
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 font-bold">{error}</div>}

            <Button 
              variant={pass === false ? 'danger' : 'primary'} 
              className="w-full h-14 text-lg font-bold mt-8 shadow-lg" 
              onClick={handleSubmit} 
              disabled={pass === null || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Inspection'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
