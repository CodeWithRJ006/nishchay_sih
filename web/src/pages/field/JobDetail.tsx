import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { haversine } from '../../utils/haversine';

interface JobDetailData {
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

export function JobDetail() {
  const { id } = useParams<{ id: string }>(); // this is application_id actually
  const navigate = useNavigate();
  const [job, setJob] = useState<JobDetailData | null>(null);
  const [error, setError] = useState('');
  const [arriving, setArriving] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  
  useEffect(() => {
    // We don't have a specific endpoint for single job, but we can fetch all and find it
    // Alternatively, we could create an endpoint, but since jobs are small, fetching all is fine for now
    fetch('/api/appointments/my-jobs')
      .then(r => r.json())
      .then((data: JobDetailData[]) => {
        const found = data.find(j => j.application_id === id);
        if (found) setJob(found);
        else setError('Job not found');
      })
      .catch(() => setError('Failed to load job details'));
  }, [id]);

  const handleArrive = async (overrideLat?: number, overrideLng?: number) => {
    setArriving(true);
    setError('');

    try {
      const getPosition = (): Promise<GeolocationPosition> => {
        return new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by this browser.'));
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
      };

      let userLat = overrideLat;
      let userLng = overrideLng;

      if (userLat === undefined || userLng === undefined) {
        const position = await getPosition();
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      }

      const dist = haversine(userLat, userLng, job!.lat, job!.lng);
      setDistance(dist);

      if (dist > 300) {
        throw new Error(`You are ${Math.round(dist)}m away. You must be within 300m of the premises to arrive.`);
      }

      const res = await fetch(`/api/field/jobs/${id}/arrive`, {
        method: 'POST',
        headers: { 'x-csrf-token': 'dummy' }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to arrive');
      }

      // Success, update local state
      setJob({ ...job!, status: 'ARRIVED' });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setArriving(false);
    }
  };

  const handleAccept = async () => {
    try {
      const res = await fetch('/api/appointments/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'dummy' },
        body: JSON.stringify({ applicationId: id })
      });
      if (!res.ok) throw new Error('Failed to accept');
      setJob({ ...job!, status: 'ACCEPTED' });
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;
    try {
      const res = await fetch('/api/appointments/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'dummy' },
        body: JSON.stringify({ applicationId: id, reason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      navigate('/field');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const isDemo = true;

  if (error && !job) return <div className="p-4 text-red-500 font-bold text-center mt-10">{error}</div>;
  if (!job) return <div className="p-4 text-center mt-10">Loading job...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative pb-24">
      {/* Back button */}
      <div className="p-4">
        <button onClick={() => navigate('/field')} className="text-primary-600 font-bold mb-4 flex items-center">
          ← Back to Jobs
        </button>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-4">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold font-heading">{job.business_name}</h2>
            <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded border uppercase">{job.status}</span>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500 font-bold text-xs uppercase">Address</p>
              <p>{job.address}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 font-bold text-xs uppercase">Application</p>
                <p className="font-mono">{job.application_id}</p>
              </div>
              <div>
                <p className="text-slate-500 font-bold text-xs uppercase">Instrument</p>
                <p className="font-mono">{job.instrument_id}</p>
              </div>
              <div>
                <p className="text-slate-500 font-bold text-xs uppercase">Slot Date</p>
                <p>{job.slot_date}</p>
              </div>
              <div>
                <p className="text-slate-500 font-bold text-xs uppercase">Slot Time</p>
                <p>{job.slot_time}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Inline SVG Map (No Tiles) */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 relative h-48">
          <svg viewBox="0 0 400 200" className="w-full h-full bg-blue-50">
            {/* Grid pattern to look like a map base */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {/* Target marker (simulated premises) */}
            <circle cx="200" cy="100" r="8" fill="#0284c7" stroke="white" strokeWidth="2" />
            <circle cx="200" cy="100" r="24" fill="#0284c7" fillOpacity="0.2" />
            <text x="215" y="105" fontSize="12" fontWeight="bold" fill="#0f172a">Premises</text>
          </svg>
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center text-xs bg-white/90 p-2 rounded shadow">
            <span>Lat: {job.lat.toFixed(4)}</span>
            <span>Lng: {job.lng.toFixed(4)}</span>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">{error}</div>}
        {distance !== null && <div className="mb-4 p-3 bg-slate-100 rounded text-sm text-center font-mono">Calculated Distance: {Math.round(distance)}m</div>}

      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t p-4 flex gap-2 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {job.status === 'SCHEDULED' ? (
          <div className="w-full flex gap-2">
            <Button variant="primary" className="flex-1 h-11" onClick={handleAccept}>
              Accept Job
            </Button>
            <Button variant="outline" className="flex-1 h-11" onClick={handleReject}>
              Reject
            </Button>
          </div>
        ) : job.status === 'ACCEPTED' ? (
          <div className="w-full flex flex-col gap-2">
            <Button variant="primary" className="w-full h-11" onClick={() => handleArrive()} disabled={arriving}>
              {arriving ? 'Locating...' : 'Arrive at Premises'}
            </Button>
            {isDemo && (
              <Button 
                variant="outline" 
                className="w-full h-11 relative" 
                onClick={() => handleArrive(job.lat, job.lng)} 
                disabled={arriving}
              >
                <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">DEMO</span>
                Use demo site location
              </Button>
            )}
          </div>
        ) : job.status === 'ARRIVED' ? (
          <Button variant="primary" className="w-full h-11" onClick={() => navigate(`/field/job/${id}/inspection`)}>
            Start Inspection
          </Button>
        ) : null}
      </div>
    </div>
  );
}
