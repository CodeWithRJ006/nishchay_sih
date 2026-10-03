import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { get, post } from '../lib/api';

interface Job {
  id: string;
  business_name: string;
  instrument_id: string;
  zone_id?: string;
}

interface Officer {
  id: string;
  name: string;
  role: string;
  zone_id?: string;
}

export function AdminUnassigned() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [selectedOfficer, setSelectedOfficer] = useState<Record<string, string>>({});

  useEffect(() => {
    get<Job[]>('/api/admin/unassigned-jobs').then(setJobs);
    get<Officer[]>('/api/admin/officers').then(setOfficers);
  }, []);

  const handleAssign = async (appId: string) => {
    const officerId = selectedOfficer[appId];
    if (!officerId) return;
    await post('/api/admin/assign', { applicationId: appId, officerId });
    setJobs(jobs.filter(j => j.id !== appId));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <PageHeader title="Unassigned Jobs" description="Manually assign jobs that could not be auto-routed." />
      <div className="mt-8 space-y-4">
        {jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-50 rounded border border-slate-200">No unassigned jobs.</div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="p-6 bg-white border border-slate-200 rounded shadow flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{job.business_name}</h3>
                <div className="mt-2 text-sm">
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded mr-2">{job.id}</span>
                  <span className="font-mono bg-slate-100 px-2 py-1 rounded mr-2">{job.instrument_id}</span>
                  <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold text-xs">{job.zone_id || 'No Zone'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  className="border rounded p-2 text-sm"
                  value={selectedOfficer[job.id] || ''}
                  onChange={e => setSelectedOfficer({ ...selectedOfficer, [job.id]: e.target.value })}
                >
                  <option value="">Select Officer...</option>
                  {officers.map(o => (
                    <option key={o.id} value={o.id}>{o.name} ({o.role} - {o.zone_id || 'All'})</option>
                  ))}
                </select>
                <Button variant="primary" onClick={() => handleAssign(job.id)} disabled={!selectedOfficer[job.id]}>Assign</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
