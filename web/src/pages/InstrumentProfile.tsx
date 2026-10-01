import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface Instrument {
  id: string;
  type_code: string;
  make: string;
  model: string;
  capacity: string;
  serial: string;
  accuracy_class?: string;
  location?: string;
  status: string;
  created_at: string;
}

export function InstrumentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/instruments/${id}`)
      .then(r => r.json())
      .then(data => {
        setInstrument(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!instrument || !('id' in instrument)) return <div className="p-4 text-red-500">Instrument not found.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/dashboard/instruments')}>&larr; Back</Button>
        <div>
          <h1 className="text-2xl font-bold text-nsh-text">Instrument Profile</h1>
          <p className="text-nsh-text-light text-sm mt-1">{instrument.id}</p>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-nsh-border font-medium flex justify-between items-center">
          <span>Details</span>
          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
            Active
          </span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-nsh-text-light uppercase tracking-wider font-semibold">Make & Model</div>
            <div className="font-medium mt-1">{instrument.make} {instrument.model}</div>
          </div>
          <div>
            <div className="text-xs text-nsh-text-light uppercase tracking-wider font-semibold">Serial Number</div>
            <div className="font-medium mt-1 font-mono">{instrument.serial}</div>
          </div>
          <div>
            <div className="text-xs text-nsh-text-light uppercase tracking-wider font-semibold">Type Code</div>
            <div className="font-medium mt-1">{instrument.type_code}</div>
          </div>
          <div>
            <div className="text-xs text-nsh-text-light uppercase tracking-wider font-semibold">Capacity</div>
            <div className="font-medium mt-1">{instrument.capacity}</div>
          </div>
          <div>
            <div className="text-xs text-nsh-text-light uppercase tracking-wider font-semibold">Accuracy Class</div>
            <div className="font-medium mt-1">{instrument.accuracy_class || 'N/A'}</div>
          </div>
          <div>
            <div className="text-xs text-nsh-text-light uppercase tracking-wider font-semibold">Location</div>
            <div className="font-medium mt-1">{instrument.location || 'N/A'}</div>
          </div>
        </div>
      </Card>
      
      <Card>
        <div className="p-4 border-b border-nsh-border font-medium">History</div>
        <div className="p-4 text-sm text-nsh-text-light">
          No history available for this instrument yet. 
          <br/><br/>
          <Button variant="primary" onClick={() => navigate(`/dashboard/apply?instrumentId=${instrument.id}`)}>
            Apply for Certification
          </Button>
        </div>
      </Card>
    </div>
  );
}
