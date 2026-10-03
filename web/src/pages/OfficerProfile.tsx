import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { get } from '../lib/api';
import { ShieldCheck, MapPin, Calendar, CheckCircle, Clock } from 'lucide-react';

interface OfficerProfileData {
  id: string;
  name: string;
  email: string;
  role: 'LMO' | 'GATC';
  zone_id: string | null;
  zone_name: string | null;
  daily_capacity: number | null;
  gatc_centre_name: string | null;
  today_load: number;
  total_assigned: number;
  total_completed: number;
}

export const OfficerProfile = () => {
  const [profile, setProfile] = useState<OfficerProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<OfficerProfileData>('/api/officer/profile')
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calibration-blue mx-auto mb-2"></div>
        Loading officer credentials...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded border border-red-200">
        Failed to load officer profile. Please sign in again.
      </div>
    );
  }

  const initials = profile.name
    ? profile.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'OF';

  const roleLabel = profile.role === 'LMO' ? 'Legal Metrology Officer' : 'Government Approved Test Centre';
  const capacityLimit = profile.daily_capacity || 8;
  const loadPercentage = Math.min(100, Math.round((profile.today_load / capacityLimit) * 100));

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <PageHeader 
        title="Officer Profile" 
        description="Official jurisdiction, credential details, and daily inspection capacity."
      />

      <NextStepBanner text="Contact an administrator to change these details." />

      {/* Main Profile Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Header with avatar, name, role chip, zone */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-calibration-blue text-white flex items-center justify-center text-xl font-bold font-heading shrink-0 shadow-inner">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold font-heading text-ink">{profile.name}</h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-calibration-blue/10 text-calibration-blue border border-calibration-blue/20">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {roleLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-600 mt-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{profile.zone_name || profile.zone_id || 'All Zones'}</span>
                {profile.gatc_centre_name && (
                  <span className="text-slate-400">• {profile.gatc_centre_name}</span>
                )}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-xs font-mono text-slate-500 uppercase">Officer ID</span>
            <div className="font-mono text-sm font-semibold text-slate-800">{profile.id}</div>
          </div>
        </div>

        {/* Today's load as a bar against daily capacity */}
        <div className="p-6 border-b border-slate-100 bg-white">
          <div className="flex justify-between items-center mb-2 text-sm">
            <span className="font-medium text-slate-700">Today's Inspection Load</span>
            <span className="font-semibold text-ink">
              {profile.today_load} of {capacityLimit} scheduled ({loadPercentage}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden" role="progressbar" aria-valuenow={profile.today_load} aria-valuemin={0} aria-valuemax={capacityLimit}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                loadPercentage >= 100
                  ? 'bg-red-600'
                  : loadPercentage > 75
                  ? 'bg-stamp-amber'
                  : 'bg-verified-green'
              }`}
              style={{ width: `${loadPercentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Auto-routing limits new assignments to {capacityLimit} slots per working day to maintain inspection rigor.
          </p>

          {/* Counts */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 p-4 rounded-md border border-slate-200/60 text-center">
              <div className="flex items-center justify-center text-calibration-blue mb-1">
                <Calendar className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Today</span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink">{profile.today_load}</div>
              <div className="text-xs text-slate-500 mt-0.5">Visits scheduled</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-md border border-slate-200/60 text-center">
              <div className="flex items-center justify-center text-stamp-amber mb-1">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Total</span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink">{profile.total_assigned}</div>
              <div className="text-xs text-slate-500 mt-0.5">Assigned jobs</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-md border border-slate-200/60 text-center">
              <div className="flex items-center justify-center text-verified-green mb-1">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Done</span>
              </div>
              <div className="text-2xl font-bold font-mono text-ink">{profile.total_completed}</div>
              <div className="text-xs text-slate-500 mt-0.5">Completed checks</div>
            </div>
          </div>
        </div>

        {/* Facts as a read-only definition list */}
        <div className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            Official Assignment Facts
          </h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="border-b border-slate-100 pb-3">
              <dt className="text-xs font-medium text-slate-500">Full Official Name</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{profile.name}</dd>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <dt className="text-xs font-medium text-slate-500">Designation & Role</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{roleLabel}</dd>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <dt className="text-xs font-medium text-slate-500">Official Government Email</dt>
              <dd className="mt-1 text-sm font-mono text-ink">{profile.email}</dd>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <dt className="text-xs font-medium text-slate-500">Jurisdiction Zone</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{profile.zone_name || profile.zone_id || 'All Zones'}</dd>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <dt className="text-xs font-medium text-slate-500">Daily Inspection Limit</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{capacityLimit} instruments per day</dd>
            </div>

            <div className="border-b border-slate-100 pb-3">
              <dt className="text-xs font-medium text-slate-500">Verification Scope</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">
                {profile.role === 'GATC'
                  ? 'Non-Automatic Weighing Instruments (NAWI Class III up to 150kg)'
                  : 'Standard Weights, Length measures, Capacity measures, Counter machines'}
              </dd>
            </div>

            {profile.gatc_centre_name && (
              <div className="border-b border-slate-100 pb-3 md:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Approved Testing Facility</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{profile.gatc_centre_name}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
};
