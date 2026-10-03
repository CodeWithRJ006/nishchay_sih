import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Toast, ToastType } from '../components/ui/Toast';
import { get, put } from '../lib/api';
import { DEMO_MODE, nextSeq } from '../lib/demo';

interface ZoneOption {
  id: string;
  name: string;
  code: string;
}

export const BusinessProfile = () => {
  const [profile, setProfile] = useState({
    name: '', type: '', address: '', zone_id: '', lat: '', lng: '', phone: '', email: ''
  });
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    Promise.all([
      get<{ name: string; type: string; address: string; zone_id: string; lat: string; lng: string; phone: string; email: string }>('/api/business/profile'),
      get<ZoneOption[]>('/api/zones').catch(() => [] as ZoneOption[])
    ]).then(([data, zoneList]) => {
      setZones(zoneList);
      setProfile({
        name: data.name || '',
        type: data.type || '',
        address: data.address || '',
        zone_id: data.zone_id || (zoneList[0]?.id || ''),
        lat: data.lat || '',
        lng: data.lng || '',
        phone: data.phone || '',
        email: data.email || ''
      });
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await put('/api/business/profile', profile);
      setToast({ message: 'Business profile updated successfully.', type: 'success' });
    } catch (e: unknown) {
      const err = e as Error;
      setToast({ message: err.message || 'Failed to update profile. Please verify your details.', type: 'error' });
    }
  };

  const fillDemo = () => {
    const n = nextSeq();
    const zoneId = zones[0]?.id || 'ZONE-1';
    setProfile({
      name: `Apex Precision Instruments ${n}`,
      type: 'Manufacturer',
      address: `Plot ${40 + n}, Okhla Industrial Area Phase-III`,
      zone_id: zoneId,
      lat: '28.5355',
      lng: '77.2638',
      phone: `9810${String(100000 + (n * 313) % 900000)}`,
      email: `compliance_${n}_${Date.now().toString().slice(-4)}@apexprecision.example`
    });
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading business profile...</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <PageHeader 
          title="Business Profile" 
          description="Manage your business identity, location, and contact information."
        />
        {DEMO_MODE && (
          <Button onClick={fillDemo} variant="outline" size="sm">
            Fill demo details
          </Button>
        )}
      </div>
      <NextStepBanner text="Ensure all details are accurate before applying for verification." />

      <form onSubmit={handleSave} className="bg-white p-6 rounded shadow-sm border border-gray-200 flex flex-col gap-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Trade Name" htmlFor="profile-trade-name">
            <Input 
              id="profile-trade-name"
              name="business_name"
              autoComplete="off"
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})} 
              required 
            />
          </Field>
          <Field label="Business Type" htmlFor="profile-business-type">
            <Select 
              id="profile-business-type"
              name="business_type"
              autoComplete="off"
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
          <Field label="Business Address" htmlFor="profile-business-address">
            <Input 
              id="profile-business-address"
              name="business_address"
              autoComplete="off"
              value={profile.address} 
              onChange={e => setProfile({...profile, address: e.target.value})} 
              required 
            />
          </Field>
          <Field label="Jurisdiction Zone" htmlFor="profile-zone-id">
            <Select 
              id="profile-zone-id"
              name="business_zone_id"
              autoComplete="off"
              value={profile.zone_id} 
              onChange={e => setProfile({...profile, zone_id: e.target.value})} 
              required
            >
              <option value="">Select a zone</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Latitude" htmlFor="profile-lat">
            <Input 
              id="profile-lat"
              name="business_lat"
              autoComplete="off"
              value={profile.lat} 
              onChange={e => setProfile({...profile, lat: e.target.value})} 
            />
          </Field>
          <Field label="Longitude" htmlFor="profile-lng">
            <Input 
              id="profile-lng"
              name="business_lng"
              autoComplete="off"
              value={profile.lng} 
              onChange={e => setProfile({...profile, lng: e.target.value})} 
            />
          </Field>
          <Field label="Phone" htmlFor="profile-phone">
            <Input 
              id="profile-phone"
              name="business_phone"
              autoComplete="off"
              type="tel"
              value={profile.phone} 
              onChange={e => setProfile({...profile, phone: e.target.value})} 
            />
          </Field>
          <Field label="Email" htmlFor="profile-email">
            <Input 
              id="profile-email"
              name="business_email"
              autoComplete="off"
              type="email"
              value={profile.email} 
              onChange={e => setProfile({...profile, email: e.target.value})} 
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="submit">Save Profile</Button>
        </div>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
