import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';

export interface Job {
  id: string;
  application_id: string;
  status: string;
  business_name: string;
  address: string;
  lat: number;
  lng: number;
  slot_date: string;
  slot_time: string;
  instrument_id: string;
}

export function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<'UNASSIGNED' | 'SCHEDULED' | 'ACCEPTED'>('SCHEDULED'); // Default to Scheduled since unassigned jobs don't technically exist for an officer in this system (they only see Scheduled and Accepted assigned to them)
  const navigate = useNavigate();

  useEffect(() => {
    get<Job[]>('/api/appointments/my-jobs')
      .then(data => {
        setJobs(data);
      });
  }, []);

  // Filter jobs based on selected tab
  // In our DB, "SCHEDULED" means assigned but not accepted. "ACCEPTED" means accepted by officer.
  const filteredJobs = jobs.filter(job => job.status === tab);

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-200 mb-4 bg-white sticky top-0">
        <button 
          className={`flex-1 py-3 text-sm font-bold text-center ${tab === 'SCHEDULED' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500'}`}
          onClick={() => setTab('SCHEDULED')}
        >
          Scheduled
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-bold text-center ${tab === 'ACCEPTED' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-slate-500'}`}
          onClick={() => setTab('ACCEPTED')}
        >
          Accepted
        </button>
      </div>

      <div className="flex-1 space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="text-center p-8 text-slate-500">No jobs in this category.</div>
        ) : (
          filteredJobs.map(job => (
            <div 
              key={job.id} 
              className="bg-white p-4 rounded-lg shadow border border-slate-100 active:bg-slate-50 cursor-pointer"
              onClick={() => navigate(`/field/job/${job.application_id}`)}
            >
              <h3 className="font-bold text-lg text-slate-800">{job.business_name}</h3>
              <p className="text-sm text-slate-600 truncate mb-2">{job.address}</p>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">{job.application_id}</span>
                <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded">
                  {job.slot_date} {job.slot_time}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
