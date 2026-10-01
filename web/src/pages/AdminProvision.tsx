import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Toast } from '../components/ui/Toast';
import { NextStepBanner } from '../components/ui/NextStepBanner';

export const AdminProvision = () => {
  const [form, setForm] = useState({
    email: '', name: '', role: 'LMO', zone_id: '', daily_capacity: '', gatc_centre_name: ''
  });
  const [toast, setToast] = useState('');

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        daily_capacity: form.daily_capacity ? parseInt(form.daily_capacity, 10) : null
      })
    });
    if (res.ok) {
      setToast('Account provisioned successfully');
      setForm({ email: '', name: '', role: 'LMO', zone_id: '', daily_capacity: '', gatc_centre_name: '' });
      setTimeout(() => setToast(''), 3000);
    } else {
      const err = await res.json();
      setToast(err.message || 'Failed to provision');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Provision Officers" 
        description="Create official accounts for LMOs and GATC personnel."
      />
      <NextStepBanner text="Provisioned users can log in using their email and the default password." />

      <form onSubmit={handleProvision} className="bg-white p-6 rounded shadow-sm border border-gray-200 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Role">
            <Select 
              value={form.role} 
              onChange={e => setForm({...form, role: e.target.value})}
            >
              <option value="LMO">Local Metrology Officer (LMO)</option>
              <option value="GATC">Govt Approved Test Centre (GATC)</option>
            </Select>
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </Field>
          <Field label="Zone ID">
            <Input value={form.zone_id} onChange={e => setForm({...form, zone_id: e.target.value})} required />
          </Field>
          
          {form.role === 'LMO' && (
            <Field label="Daily Inspection Capacity">
              <Input 
                type="number" 
                value={form.daily_capacity} 
                onChange={e => setForm({...form, daily_capacity: e.target.value})} 
              />
            </Field>
          )}
          
          {form.role === 'GATC' && (
            <Field label="GATC Centre Name">
              <Input 
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
      {toast && <Toast message={toast} type={toast.includes('Failed') ? 'error' : 'success'} />}
    </div>
  );
};
