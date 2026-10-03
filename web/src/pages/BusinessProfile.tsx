import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { get, put } from '../lib/api';

export const BusinessProfile = () => {
  const [profile, setProfile] = useState({
    name: '', type: '', address: '', zone_id: '', lat: '', lng: '', phone: '', email: ''
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    get<{ name: string; type: string; address: string; zone_id: string; lat: string; lng: string; phone: string; email: string }>('/api/business/profile')
      .then(data => {
        setProfile({
          name: data.name || '',
          type: data.type || '',
          address: data.address || '',
          zone_id: data.zone_id || '',
          lat: data.lat || '',
          lng: data.lng || '',
          phone: data.phone || '',
          email: data.email || ''
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await put('/api/business/profile', profile);
    setToast('Profile saved successfully');
    setTimeout(() => setToast(''), 3000);
  };

  const fillDemo = () => {
    setProfile({
      name: 'Demo Industries Pvt Ltd',
      type: 'Manufacturer',
      address: 'Plot 42, Industrial Area Phase 1',
      zone_id: 'ZONE-1',
      lat: '28.6139',
      lng: '77.2090',
      phone: '+91 9876543210',
      email: 'contact@demoindustries.com'
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <PageHeader 
          title="Business Profile" 
          description="Manage your business identity, location, and contact information."
        />
        <Button onClick={fillDemo} variant="outline">Fill demo details</Button>
      </div>
      <NextStepBanner text="Ensure all details are accurate before applying for verification." />

      <form onSubmit={handleSave} className="bg-white p-6 rounded shadow-sm border border-gray-200 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Trade Name">
            <Input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required />
          </Field>
          <Field label="Business Type">
            <Select 
              value={profile.type} 
              onChange={e => setProfile({...profile, type: e.target.value})}
            >
              <option value="">Select Type</option>
              <option value="Manufacturer">Manufacturer</option>
              <option value="Dealer">Dealer</option>
              <option value="Repairer">Repairer</option>
              <option value="Packer">Packer</option>
            </Select>
          </Field>
          <Field label="Address">
            <Input value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} required />
          </Field>
          <Field label="Zone ID">
            <Input value={profile.zone_id} onChange={e => setProfile({...profile, zone_id: e.target.value})} required />
          </Field>
          <Field label="Latitude">
            <Input value={profile.lat} onChange={e => setProfile({...profile, lat: e.target.value})} />
          </Field>
          <Field label="Longitude">
            <Input value={profile.lng} onChange={e => setProfile({...profile, lng: e.target.value})} />
          </Field>
          <Field label="Phone">
            <Input value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} />
          </Field>
          <Field label="Email">
            <Input value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="submit">Save Profile</Button>
        </div>
      </form>
      {toast && <Toast message={toast} type="success" />}
    </div>
  );
};
