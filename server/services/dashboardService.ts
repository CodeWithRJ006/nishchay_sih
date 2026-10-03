import { 
  getBusinessByOwnerId, 
  getDashboardKpis, 
  getOpenApplications, 
  getInstrumentsWithStatus, 
  getRecentPaymentsForBusiness, 
  getCertificatesForBusiness 
} from '../repositories/dashboardRepo.js';

export interface NextStepBannerInfo {
  title: string;
  description: string;
  actionLabel: string;
  actionUrl: string;
}

export function getBusinessDashboardData(ownerId: string) {
  const business = getBusinessByOwnerId(ownerId);
  if (!business) {
    return {
      tradeName: 'My Business',
      businessId: '',
      kpis: {
        totalInstruments: 0,
        validCertificates: 0,
        openApplications: 0,
        feesPaid: 0,
      },
      nextStep: {
        title: 'Register your business details',
        description: 'Complete your business profile to begin managing instruments and applications.',
        actionLabel: 'Complete profile',
        actionUrl: '/dashboard/profile',
      },
      applicationsInProgress: [],
      instruments: [],
      recentPayments: [],
      certificates: [],
    };
  }

  const kpis = getDashboardKpis(business.id);
  const openApps = getOpenApplications(business.id);
  const instruments = getInstrumentsWithStatus(business.id);
  const recentPayments = getRecentPaymentsForBusiness(business.id, 5);
  const certificates = getCertificatesForBusiness(business.id);

  // Compute next step based on the most advanced open application
  let nextStep: NextStepBannerInfo;

  // Precedence order: INSPECTED_PASS -> ACCEPTED -> SCHEDULED -> PAID -> SUBMITTED -> DRAFT
  const stateRank: Record<string, number> = {
    INSPECTED_PASS: 6,
    ACCEPTED: 5,
    SCHEDULED: 4,
    PAID: 3,
    SUBMITTED: 2,
    DRAFT: 1,
  };

  const sortedOpenApps = [...openApps].sort((a, b) => {
    const rankA = stateRank[a.state] || 0;
    const rankB = stateRank[b.state] || 0;
    return rankB - rankA;
  });

  const topApp = sortedOpenApps[0];

  if (topApp) {
    switch (topApp.state) {
      case 'INSPECTED_PASS':
        nextStep = {
          title: 'Inspection passed — certificate pending',
          description: `Instrument ${topApp.instrument_make} ${topApp.instrument_model} (${topApp.instrument_serial}) passed inspection. Seal generation in progress.`,
          actionLabel: 'View application',
          actionUrl: `/dashboard/applications/${topApp.id}`,
        };
        break;
      case 'ACCEPTED':
        nextStep = {
          title: 'Inspection appointment confirmed',
          description: `Officer ${topApp.officer_name || 'assigned'} confirmed inspection for ${topApp.slot_date || 'scheduled date'} (${topApp.slot_time || 'scheduled time'}).`,
          actionLabel: 'Track appointment',
          actionUrl: `/dashboard/applications/${topApp.id}`,
        };
        break;
      case 'SCHEDULED':
        nextStep = {
          title: 'Inspection scheduled',
          description: `Inspection scheduled for ${topApp.slot_date || 'scheduled date'} (${topApp.slot_time || 'scheduled time'}). Ensure instrument is accessible on premises.`,
          actionLabel: 'View appointment',
          actionUrl: `/dashboard/applications/${topApp.id}`,
        };
        break;
      case 'PAID':
        nextStep = {
          title: 'Fee received — choose inspection slot',
          description: `Fee payment verified for ${topApp.instrument_make} ${topApp.instrument_model}. Select an appointment date.`,
          actionLabel: 'Schedule inspection',
          actionUrl: `/dashboard/schedule/${topApp.id}`,
        };
        break;
      case 'SUBMITTED':
        nextStep = {
          title: 'Fee payment required',
          description: `Official verification fee of ₹${topApp.fee_amount} is ready for payment for ${topApp.instrument_make} ${topApp.instrument_model}.`,
          actionLabel: 'Pay fee',
          actionUrl: `/dashboard/payment/${topApp.id}`,
        };
        break;
      default:
        nextStep = {
          title: 'Complete verification application',
          description: `Draft application for ${topApp.instrument_make} ${topApp.instrument_model} is ready for review and submission.`,
          actionLabel: 'Resume application',
          actionUrl: `/dashboard/apply?applicationId=${topApp.id}`,
        };
        break;
    }
  } else if (instruments.length === 0) {
    nextStep = {
      title: 'Register your first instrument',
      description: 'Add your commercial weighing or measuring equipment to begin the digital verification process.',
      actionLabel: 'Register instrument',
      actionUrl: '/dashboard/instruments',
    };
  } else if (instruments.some(i => i.status !== 'CERTIFIED')) {
    nextStep = {
      title: 'Apply for verification',
      description: 'You have uncertified instruments registered. Apply for verification to obtain Legal Metrology compliance.',
      actionLabel: 'Apply for verification',
      actionUrl: '/dashboard/apply',
    };
  } else {
    nextStep = {
      title: 'All instruments verified',
      description: 'All registered equipment has valid Legal Metrology certification with verified seals.',
      actionLabel: 'Register instrument',
      actionUrl: '/dashboard/instruments',
    };
  }

  return {
    tradeName: business.name,
    businessId: business.id,
    kpis,
    nextStep,
    applicationsInProgress: openApps,
    instruments,
    recentPayments,
    certificates,
  };
}
