import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { Toast, ToastType } from '../components/ui/Toast';
import { get, post } from '../lib/api';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { DEMO_MODE, nextSeq } from '../lib/demo';
import { Copy, Check, ShieldCheck, UserPlus, Users } from 'lucide-react';

interface ZoneOption {
  id: string;
  name: string;
  code: string;
}

interface OfficerRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  zone_id?: string;
  zone_name?: string;
  daily_capacity?: number;
  gatc_centre_name?: string;
}

interface ProvisionedCreds {
  id: string;
  name: string;
  email: string;
  role: string;
  defaultPassword: string;
}

export const AdminProvision = () => {
  const [form, setForm] = useState({
    email: '', name: '', role: 'LMO', zone_id: '', daily_capacity: '', gatc_centre_name: ''
  });
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [officers, setOfficers] = useState<OfficerRecord[]>([]);
  const [provisionedCreds, setProvisionedCreds] = useState<ProvisionedCreds | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const loadOfficers = useCallback(async () => {
    try {
      const data = await get<OfficerRecord[]>('/api/admin/officers');
      setOfficers(data);
    } catch {
      // quiet catch
    }
  }, []);

  useEffect(() => {
    get<ZoneOption[]>('/api/zones')
      .then(data => {
        setZones(data);
        if (data.length > 0) {
          setForm(prev => prev.zone_id ? prev : { ...prev, zone_id: data[0].id });
        }
      })
      .catch(() => {});

    loadOfficers();
  }, [loadOfficers]);

  const fillDemo = () => {
    const n = nextSeq();
    const defaultZone = zones[0]?.id || 'Z-HYD-01';
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
      const res = await post<ProvisionedCreds>('/api/admin/provision', {
        ...form,
        daily_capacity: form.daily_capacity ? parseInt(form.daily_capacity, 10) : null
      });
      setProvisionedCreds({
        id: res.id,
        name: res.name || form.name,
        email: res.email || form.email,
        role: res.role || form.role,
        defaultPassword: res.defaultPassword || 'demo123',
      });
      setToast({ message: 'Account provisioned successfully. Sign-in details generated.', type: 'success' });
      setForm({ email: '', name: '', role: 'LMO', zone_id: zones[0]?.id || '', daily_capacity: '', gatc_centre_name: '' });
      await loadOfficers();
    } catch (e: unknown) {
      const err = e as Error;
      setToast({ message: err.message || 'Failed to provision account. Check fields and retry.', type: 'error' });
    }
  };

  const copyCredentials = async () => {
    if (!provisionedCreds) return;
    const text = `NISHCHAY Credentials:\nRole: ${provisionedCreds.role}\nEmail: ${provisionedCreds.email}\nDefault Password: ${provisionedCreds.defaultPassword}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      setToast({ message: 'Sign-in credentials copied to clipboard.', type: 'info' });
    } catch {
      setToast({ message: 'Failed to copy to clipboard', type: 'error' });
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <PageHeader 
        title="Provision Officers" 
        description="Create official accounts for Legal Metrology Officers (LMO) and Government Approved Test Centres (GATC)."
      />
      <NextStepBanner text="Provisioned users can log in using their email and the demo default password." />

      {/* Result Panel when provisioned */}
      {provisionedCreds && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-verified-green" />
              <h2 className="text-base font-bold font-heading text-emerald-950">
                Account Provisioned Successfully
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyCredentials}
              className="flex items-center gap-1.5 text-xs bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-verified-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy sign-in details'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs">
            <div>
              <span className="text-slate-500 uppercase font-semibold text-[10px] block">Officer Name</span>
              <span className="font-semibold text-ink text-sm mt-0.5 block">{provisionedCreds.name}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-semibold text-[10px] block">Role Designation</span>
              <span className="font-semibold text-ink text-sm mt-0.5 block">{provisionedCreds.role}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-semibold text-[10px] block">Sign-in Email</span>
              <span className="font-mono text-ink text-sm mt-0.5 block font-semibold">{provisionedCreds.email}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-semibold text-[10px] block">Demo Default Password</span>
              <span className="font-mono text-verified-green font-bold text-sm mt-0.5 block">{provisionedCreds.defaultPassword}</span>
            </div>
          </div>
        </div>
      )}

      {/* Provisioning Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-2xl">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-ink font-bold font-heading">
            <UserPlus className="w-5 h-5 text-calibration-blue" />
            <span>Create New Officer Account</span>
          </div>

          {DEMO_MODE && (
            <Button type="button" variant="outline" size="sm" onClick={fillDemo} className="text-xs">
              Fill demo details
            </Button>
          )}
        </div>

        <form onSubmit={handleProvision} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Role" htmlFor="provision-role">
              <Select 
                id="provision-role"
                name="provision_role"
                autoComplete="off"
                value={form.role} 
                onChange={e => setForm({...form, role: e.target.value})}
              >
                <option value="LMO">Legal Metrology Officer (LMO)</option>
                <option value="GATC">Govt Approved Test Centre (GATC)</option>
              </Select>
            </Field>

            <Field label="Officer Name" htmlFor="provision-name">
              <Input 
                id="provision-name"
                name="provision_name"
                autoComplete="off"
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="e.g., Rajesh Sharma"
                required 
              />
            </Field>

            <Field label="Official Email" htmlFor="provision-email">
              <Input 
                id="provision-email"
                name="provision_email"
                autoComplete="off"
                type="email" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})} 
                placeholder="officer@department.example"
                required 
              />
            </Field>

            <Field label="Jurisdiction Zone" htmlFor="provision-zone-id">
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
                  <option key={z.id} value={z.id}>{z.name} ({z.id})</option>
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
                  placeholder="8"
                />
              </Field>
            )}
            
            {form.role === 'GATC' && (
              <Field label="Testing Centre Name" htmlFor="provision-gatc-name">
                <Input 
                  id="provision-gatc-name"
                  name="provision_gatc_centre_name"
                  autoComplete="off"
                  value={form.gatc_centre_name} 
                  onChange={e => setForm({...form, gatc_centre_name: e.target.value})} 
                  placeholder="Deccan Metrology Lab"
                />
              </Field>
            )}
          </div>

          <div className="mt-2 pt-3 border-t border-slate-100 flex justify-end">
            <Button type="submit" variant="primary">Provision Account</Button>
          </div>
        </form>
      </div>

      {/* List of provisioned officers */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Users className="w-5 h-5 text-calibration-blue" />
          <h2 className="text-base font-bold font-heading text-ink">
            Provisioned Officers & Testing Centres
          </h2>
        </div>

        {officers.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">No officers currently registered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Jurisdiction Zone</th>
                  <th className="pb-3">Capacity / Facility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {officers.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="py-3 font-semibold text-ink">{o.name}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                        o.role === 'LMO' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {o.role}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-600">{o.email || `${o.id.toLowerCase()}@nishchay.example`}</td>
                    <td className="py-3 text-slate-700">{o.zone_name || o.zone_id || 'All Zones'}</td>
                    <td className="py-3 text-slate-600">
                      {o.role === 'GATC'
                        ? o.gatc_centre_name || 'Standard Centre'
                        : `${o.daily_capacity || 8} visits/day`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
