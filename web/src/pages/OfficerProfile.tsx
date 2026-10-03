import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { Input } from '../components/ui/Input';
import { Field } from '../components/ui/Field';
import { get } from '../lib/api';

export const OfficerProfile = () => {
  const [profile, setProfile] = useState<{name: string, role: string, zone_id: string, daily_capacity?: number, gatc_centre_name?: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{name: string, role: string, zone_id: string, daily_capacity?: number, gatc_centre_name?: string}>('/api/officer/profile')
      .then(data => {
        setProfile(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Officer Profile" 
        description="View your official assignment and capacity details."
      />
      <NextStepBanner text="Contact an administrator to request changes to these details." />

      <div className="bg-white p-6 rounded shadow-sm border border-gray-200 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <Input value={profile?.name || ''} readOnly />
          </Field>
          <Field label="Role">
            <Input value={profile?.role || ''} readOnly />
          </Field>
          <Field label="Zone ID">
            <Input value={profile?.zone_id || ''} readOnly />
          </Field>
          {profile?.role === 'LMO' && (
            <Field label="Daily Capacity">
              <Input value={profile?.daily_capacity || 'Not set'} readOnly />
            </Field>
          )}
          {profile?.role === 'GATC' && (
            <Field label="Centre Name">
              <Input value={profile?.gatc_centre_name || 'Not set'} readOnly />
            </Field>
          )}
        </div>
      </div>
    </div>
  );
};
