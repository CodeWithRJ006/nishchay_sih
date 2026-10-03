import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { get, post } from '../lib/api';

export function ApplicationSchedule() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<{date: string, slots: string[]}[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    get('/api/appointments/slots')
      .then(setSlots)
      .finally(() => setLoading(false));
  }, []);

  const handleSchedule = async () => {
    try {
      const res = await post('/api/appointments/schedule', { applicationId, slotDate: selectedDate, slotTime: selectedTime });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule');
      navigate('/dashboard');
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    }
  };

  if (loading) return <div>Loading slots...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <PageHeader title="Schedule Verification" description="Pick a suitable slot for the physical inspection." />
      
      {error && <div className="text-red-600 bg-red-50 p-4 rounded mb-6">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <h3 className="text-lg font-bold mb-4">1. Select Date</h3>
          <div className="space-y-2">
            {slots.map(s => (
              <label key={s.date} className={`block p-4 border rounded cursor-pointer ${selectedDate === s.date ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <input type="radio" name="date" value={s.date} className="sr-only" onChange={() => setSelectedDate(s.date)} />
                <span className="font-bold">{new Date(s.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-4">2. Select Time</h3>
          {selectedDate ? (
            <div className="space-y-2">
              {slots.find(s => s.date === selectedDate)?.slots.map(t => (
                <label key={t} className={`block p-4 border rounded cursor-pointer ${selectedTime === t ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input type="radio" name="time" value={t} className="sr-only" onChange={() => setSelectedTime(t)} />
                  <span className="font-bold capitalize">{t.toLowerCase()}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded text-slate-500">Please select a date first.</div>
          )}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button variant="primary" disabled={!selectedDate || !selectedTime} onClick={handleSchedule}>Confirm Booking</Button>
      </div>

      <div className="mt-8">
        <NextStepBanner title="An officer will be assigned and they will visit your premises." />
      </div>
    </div>
  );
}
