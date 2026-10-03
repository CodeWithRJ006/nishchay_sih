// import React and hooks
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// UI components
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { NextStepBanner } from '../components/ui/NextStepBanner';
// API client
import { get, post } from '../lib/api';
import { DEMO_MODE, nextSeq } from '../lib/demo';

// Instrument data shape
interface Instrument {
  id: string;
  type_code: string;
  make: string;
  model: string;
  serial: string;
  capacity: string;
}

export function Instruments() {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // form state
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [capacity, setCapacity] = useState('');
  const [typeCode, setTypeCode] = useState('NAWI-3');
  const [accuracyClass, setAccuracyClass] = useState('III');
  const [location, setLocation] = useState('');

  // load instruments on mount
  useEffect(() => {
    get<Instrument[]>('/api/instruments')
      .then(data => {
        if (Array.isArray(data)) setInstruments(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load instruments');
        setLoading(false);
      });
  }, []);

  const fillDemo = () => {
    const n = nextSeq();
    setMake('WeighCorp Precision');
    setModel(`WC-${100 + n}`);
    setSerial(`SN-${n}-${Date.now().toString().slice(-4)}`);
    setCapacity('150kg');
    setTypeCode('NAWI-3');
    setAccuracyClass('III');
    setLocation('Shop Floor Counter 1');
  };

  interface RegisterResponse { id: string; }
  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await post<RegisterResponse>('/api/instruments', {
        type_code: typeCode,
        make,
        model,
        serial,
        capacity,
        accuracy_class: accuracyClass,
        location,
      });
      if (res && res.id) {
        navigate(`/dashboard/instruments/${res.id}`);
      } else {
        setError('Registration failed. Please verify the serial number is unique.');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Registration failed. Serial number must be unique.');
    }
  };

  if (loading) return <div className="p-4">Loading instruments...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nsh-text">Instruments</h1>
          <p className="text-nsh-text-light text-sm mt-1">Manage your weighing and measuring instruments.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/dashboard/apply')}>New Application</Button>
      </div>

      <NextStepBanner
        title="Register your instruments"
        description="Add all instruments used in your business to begin the certification process."
      />

      {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4 border-b border-nsh-border flex justify-between items-center">
            <span className="font-medium">Register New Instrument</span>
            {DEMO_MODE && (
              <Button type="button" variant="outline" size="sm" onClick={fillDemo}>
                Fill demo details
              </Button>
            )}
          </div>
          <form onSubmit={register} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="instrument-type" className="block text-sm font-medium mb-1">Type</label>
                <Select 
                  id="instrument-type"
                  name="instrument_type"
                  autoComplete="off"
                  value={typeCode} 
                  onChange={e => setTypeCode(e.target.value)} 
                  required
                >
                  <option value="NAWI-3">Non-Automatic Weighing Instrument (Class III)</option>
                  <option value="W-1">Weights</option>
                  <option value="WM-1">Water Meter</option>
                  <option value="FSM-1">Fuel Dispenser</option>
                </Select>
              </div>
              <div>
                <label htmlFor="instrument-capacity" className="block text-sm font-medium mb-1">Capacity</label>
                <Input 
                  id="instrument-capacity"
                  name="instrument_capacity"
                  autoComplete="off"
                  value={capacity} 
                  onChange={e => setCapacity(e.target.value)} 
                  required 
                  placeholder="e.g. 150kg" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="instrument-make" className="block text-sm font-medium mb-1">Make</label>
                <Input 
                  id="instrument-make"
                  name="instrument_make"
                  autoComplete="off"
                  value={make} 
                  onChange={e => setMake(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label htmlFor="instrument-model" className="block text-sm font-medium mb-1">Model</label>
                <Input 
                  id="instrument-model"
                  name="instrument_model"
                  autoComplete="off"
                  value={model} 
                  onChange={e => setModel(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="instrument-serial" className="block text-sm font-medium mb-1">Serial Number</label>
                <Input 
                  id="instrument-serial"
                  name="instrument_serial"
                  autoComplete="off"
                  value={serial} 
                  onChange={e => setSerial(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label htmlFor="instrument-class" className="block text-sm font-medium mb-1">Accuracy Class</label>
                <Input 
                  id="instrument-class"
                  name="instrument_accuracy_class"
                  autoComplete="off"
                  value={accuracyClass} 
                  onChange={e => setAccuracyClass(e.target.value)} 
                />
              </div>
            </div>
            <div>
              <label htmlFor="instrument-location" className="block text-sm font-medium mb-1">Location (Optional)</label>
              <Input 
                id="instrument-location"
                name="instrument_location"
                autoComplete="off"
                value={location} 
                onChange={e => setLocation(e.target.value)} 
                placeholder="e.g. Shop Floor 1" 
              />
            </div>
            <Button type="submit" className="w-full">Register Instrument</Button>
          </form>
        </Card>

        <Card>
          <div className="p-4 border-b border-nsh-border font-medium">Your Instruments</div>
          <div className="divide-y divide-nsh-border">
            {instruments.length === 0 ? (
              <div className="p-8 text-center text-nsh-text-light">No instruments registered yet.</div>
            ) : (
              instruments.map(i => (
                <div key={i.id} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/dashboard/instruments/${i.id}`)}>
                  <div>
                    <div className="font-medium">{i.make} {i.model}</div>
                    <div className="text-sm text-nsh-text-light">SN: {i.serial} • Cap: {i.capacity}</div>
                  </div>
                  <div className="text-sm font-mono bg-blue-50 text-nsh-primary px-2 py-1 rounded">{i.id}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
