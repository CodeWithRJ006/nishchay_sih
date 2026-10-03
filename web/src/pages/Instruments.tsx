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
    setMake('WeighCorp');
    setModel('M-250');
    setSerial('WC-' + Math.floor(Math.random() * 10000));
    setCapacity('250kg');
    setTypeCode('NAWI-3');
    setAccuracyClass('III');
    setLocation('Counter 1');
  };

  interface RegisterResponse { id: string; }
  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      setError('Registration failed');
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

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
        actionLabel="Fill Demo Details"
        onAction={fillDemo}
      />

      {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-4 border-b border-nsh-border font-medium">Register New Instrument</div>
          <form onSubmit={register} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <Select value={typeCode} onChange={e => setTypeCode(e.target.value)} required>
                  <option value="NAWI-3">Non-Automatic Weighing Instrument (Class III)</option>
                  <option value="W-1">Weights</option>
                  <option value="WM-1">Water Meter</option>
                  <option value="FSM-1">Fuel Dispenser</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Capacity</label>
                <Input value={capacity} onChange={e => setCapacity(e.target.value)} required placeholder="e.g. 150kg" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Make</label>
                <Input value={make} onChange={e => setMake(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <Input value={model} onChange={e => setModel(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Serial Number</label>
                <Input value={serial} onChange={e => setSerial(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Accuracy Class</label>
                <Input value={accuracyClass} onChange={e => setAccuracyClass(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location (Optional)</label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Shop Floor 1" />
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
