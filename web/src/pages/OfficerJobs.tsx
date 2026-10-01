import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';

export function OfficerJobs() {
  const [jobs, setJobs] = useState<Record<string, string>[]>([]);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetch('/api/appointments/my-jobs').then(r => r.json()).then(setJobs);
  }, []);

  const handleAccept = async (appId: string) => {
    await fetch('/api/appointments/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'dummy' },
      body: JSON.stringify({ applicationId: appId })
    });
    setJobs(jobs.map(j => j.application_id === appId ? { ...j, status: 'ACCEPTED', state: 'ACCEPTED' } : j));
  };

  const handleReject = async (appId: string) => {
    if (!reason) return;
    await fetch('/api/appointments/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'dummy' },
      body: JSON.stringify({ applicationId: appId, reason })
    });
    setJobs(jobs.filter(j => j.application_id !== appId));
    setRejecting(null);
    setReason('');
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <PageHeader title="My Jobs" description="Review and accept your assigned verification jobs." />
      
      <div className="mt-8 space-y-4">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-50 rounded border border-slate-200">No jobs assigned.</div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="p-6 bg-white border border-slate-200 rounded shadow flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{job.business_name}</h3>
                <p className="text-sm text-slate-600">{job.address}</p>
                <div className="mt-2 text-sm">
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded mr-2">{job.application_id}</span>
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded mr-2">{job.instrument_id}</span>
                  <span className="font-bold text-primary-700">{job.slot_date} {job.slot_time}</span>
                </div>
                <div className="mt-2 text-xs font-bold text-slate-500 uppercase">{job.state}</div>
              </div>
              <div className="flex flex-col gap-2">
                {job.status === 'SCHEDULED' && job.state === 'SCHEDULED' && rejecting !== job.application_id && (
                  <>
                    <Button variant="primary" onClick={() => handleAccept(job.application_id)}>Accept</Button>
                    <Button variant="outline" onClick={() => setRejecting(job.application_id)}>Reject</Button>
                  </>
                )}
                {rejecting === job.application_id && (
                  <div className="flex gap-2">
                    <input type="text" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} className="border p-2 rounded text-sm" />
                    <Button variant="danger" onClick={() => handleReject(job.application_id)}>Confirm Reject</Button>
                    <Button variant="secondary" onClick={() => setRejecting(null)}>Cancel</Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
