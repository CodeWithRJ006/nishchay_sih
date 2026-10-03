import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Toast, ToastType } from '../components/ui/Toast';
import { get, post } from '../lib/api';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { DEMO_MODE, nextSeq } from '../lib/demo';

interface ZoneOption {
  id: string;
  name: string;
  code: string;
}

export const AdminProvision = () => {
  const [form, setForm] = useState({
    email: '', name: '', role: 'LMO', zone_id: '', daily_capacity: '', gatc_centre_name: ''
  });
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    get<ZoneOption[]>('/api/zones')
      .then(data => {
        setZones(data);
        if (data.length > 0) {
          setForm(prev => prev.zone_id ? prev : { ...prev, zone_id: data[0].id });
        }
      })
      .catch(() => {});
  }, []);

  const fillDemo = () => {
    const n = nextSeq();
    const defaultZone = zones[0]?.id || 'ZONE-1';
    setForm({
      name: `Officer ${n}`,
      email: `officer_${n}_${Date.now().toString().slice(-4)}@nishchay.example`,
      role: 'LMO',
      zone_id: defaultZone,
      daily_capacity: '8',
      gatc_centre_name: ''
    });
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/api/admin/provision', {
        ...form,
        daily_capacity: form.daily_capacity ? parseInt(form.daily_capacity, 10) : null
      });
      setToast({ message: 'Account provisioned successfully. User can now sign in.', type: 'success' });
      setForm({ email: '', name: '', role: 'LMO', zone_id: zones[0]?.id || '', daily_capacity: '', gatc_centre_name: '' });
    } catch (e: unknown) {
      const err = e as Error;
      setToast({ message: err.message || 'Failed to provision account. Check fields and retry.', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Provision Officers" 
        description="Create official accounts for LMOs and GATC personnel."
      />
      <NextStepBanner text="Provisioned users can log in using their email and the default password." />

      {DEMO_MODE && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={fillDemo}>
            Fill demo details
          </Button>
        </div>
      )}

      <form onSubmit={handleProvision} className="bg-white p-6 rounded shadow-sm border border-gray-200 flex flex-col gap-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Role" htmlFor="provision-role">
            <Select 
              id="provision-role"
              name="provision_role"
              autoComplete="off"
              value={form.role} 
              onChange={e => setForm({...form, role: e.target.value})}
            >
              <option value="LMO">Local Metrology Officer (LMO)</option>
              <option value="GATC">Govt Approved Test Centre (GATC)</option>
            </Select>
          </Field>
          <Field label="Name" htmlFor="provision-name">
            <Input 
              id="provision-name"
              name="provision_name"
              autoComplete="off"
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              required 
            />
          </Field>
          <Field label="Email" htmlFor="provision-email">
            <Input 
              id="provision-email"
              name="provision_email"
              autoComplete="off"
              type="email" 
              value={form.email} 
              onChange={e => setForm({...form, email: e.target.value})} 
              required 
            />
          </Field>
          <Field label="Zone" htmlFor="provision-zone-id">
            <Select 
              id="provision-zone-id"
              name="provision_zone_id"
              autoComplete="off"
              value={form.zone_id} 
              onChange={e => setForm({...form, zone_id: e.target.value})} 
              required
            >
              <option value="">Select a zone</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </Select>
          </Field>
          
          {form.role === 'LMO' && (
            <Field label="Daily Inspection Capacity" htmlFor="provision-daily-capacity">
              <Input 
                id="provision-daily-capacity"
                name="provision_daily_capacity"
                autoComplete="off"
                type="number" 
                value={form.daily_capacity} 
                onChange={e => setForm({...form, daily_capacity: e.target.value})} 
              />
            </Field>
          )}
          
          {form.role === 'GATC' && (
            <Field label="GATC Centre Name" htmlFor="provision-gatc-name">
              <Input 
                id="provision-gatc-name"
                name="provision_gatc_centre_name"
                autoComplete="off"
                value={form.gatc_centre_name} 
                onChange={e => setForm({...form, gatc_centre_name: e.target.value})} 
              />
            </Field>
          )}
        </div>
        <div className="mt-4">
          <Button type="submit">Provision Account</Button>
        </div>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
