import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.js';

export type Role = 'ADMIN' | 'LMO' | 'GATC' | 'BUSINESS' | 'PUBLIC' | 'HMAC';

export interface RouteDef {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  roles: Role[];
  objectPolicy?: (req: Request) => Promise<boolean> | boolean;
}

export const routeTable: RouteDef[] = [
  { method: 'POST', path: '/api/auth/register', roles: ['PUBLIC'] },
  { method: 'POST', path: '/api/auth/login', roles: ['PUBLIC'] },
  { method: 'POST', path: '/api/auth/logout', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/auth/me', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/demo/login-as/:role', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/demo/trigger-callback', roles: ['BUSINESS'] },
  { method: 'GET', path: '/api/public/keys', roles: ['PUBLIC'] },
  { method: 'GET', path: '/api/config', roles: ['PUBLIC'] },
  // Block 7 Certificate Routes
  { method: 'POST', path: '/api/certificates/:appId/issue', roles: ['LMO', 'GATC'] },
  { method: 'GET', path: '/api/certificates/:publicId', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/certificates/:publicId/revoke', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/health', roles: ['PUBLIC'] },
  // Demo mode routes (only active when DEMO_MODE=true)
  { method: 'GET', path: '/api/demo/progress', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/admin/demo/issue-no-payment', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/admin/demo/tamper', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/admin/demo/undo-tamper', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/admin/demo/tamper-status', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/admin/demo/reset', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  // Block 9 Certificate Search & Export
  { method: 'GET', path: '/api/certificates/search', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/certificates/export', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/certificates/:publicId/pdf', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  
  { method: 'GET', path: '/api/public/verify/:publicId', roles: ['PUBLIC', 'BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/public/certificates/:publicId/complaints', roles: ['PUBLIC'] },
  
  // Right to Check complaint route
  { method: 'POST', path: '/api/certificates/:publicId/complaint', roles: ['PUBLIC'] },
  { method: 'POST', path: '/api/admin/provision', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/business/profile', roles: ['BUSINESS'] },
  { method: 'PUT', path: '/api/business/profile', roles: ['BUSINESS'], objectPolicy: ownsBusiness },
  { method: 'GET', path: '/api/officer/profile', roles: ['LMO', 'GATC'] },
  { method: 'GET', path: '/api/zones', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/dashboard/business', roles: ['BUSINESS'] },
  { method: 'GET', path: '/api/dashboard/officer', roles: ['LMO', 'GATC'] },
  { method: 'GET', path: '/api/dashboard/admin', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/admin/complaints', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/admin/activity-feed', roles: ['ADMIN'] },

  // Block 4b Routes
  { method: 'POST', path: '/api/instruments', roles: ['BUSINESS'] },
  { method: 'GET', path: '/api/instruments', roles: ['BUSINESS'] },
  { method: 'GET', path: '/api/instruments/:id', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/upload', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/documents/:fileName', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/applications', roles: ['BUSINESS'] },
  { method: 'GET', path: '/api/applications', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'GET', path: '/api/applications/:id', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/payments/initiate', roles: ['BUSINESS'] },
  { method: 'POST', path: '/api/payments/callback', roles: ['HMAC'] },
  { method: 'GET', path: '/api/admin/payments', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/admin/receipts', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/admin/gate-blocks', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/appointments/slots', roles: ['BUSINESS'] },
  { method: 'POST', path: '/api/appointments/schedule', roles: ['BUSINESS'] },
  { method: 'POST', path: '/api/appointments/accept', roles: ['LMO', 'GATC'], objectPolicy: ownsAppointment },
  { method: 'POST', path: '/api/appointments/reject', roles: ['LMO', 'GATC'], objectPolicy: ownsAppointment },
  { method: 'GET', path: '/api/appointments/my-jobs', roles: ['LMO', 'GATC'] },
  { method: 'GET', path: '/api/admin/unassigned-jobs', roles: ['ADMIN'] },
  { method: 'POST', path: '/api/admin/assign', roles: ['ADMIN'] },
  { method: 'GET', path: '/api/admin/officers', roles: ['ADMIN'] },
  
  // Block 6a/6b Field Routes
  { method: 'POST', path: '/api/field/jobs/:id/arrive', roles: ['LMO', 'GATC'], objectPolicy: isAssignedOfficer },
  { method: 'POST', path: '/api/field/jobs/:id/inspection', roles: ['LMO', 'GATC'], objectPolicy: isAssignedOfficer },
];

export function ownsBusiness(req: Request): boolean {
  const user = (req as unknown as Record<string, unknown>).user as { id: string } | undefined;
  if (!user) return false;
  
  const bizId = req.params.id || req.body.id || req.query.id;
  if (bizId) {
     const row = db.prepare('SELECT owner_id FROM businesses WHERE id = ?').get(bizId) as { owner_id: string } | undefined;
     return row?.owner_id === user.id;
  }
  return true;
}
export function inJurisdiction(req: Request): boolean {
  const user = (req as unknown as Record<string, unknown>).user as { id: string, zone_id: string | null } | undefined;
  if (!user) return false;
  
  let jobId = req.params.id || req.body.id || req.query.id;
  if (!jobId && req.path.match(/\/jobs\/([^/]+)/)) {
    jobId = req.path.match(/\/jobs\/([^/]+)/)![1];
  }
  if (!jobId && req.path.match(/\/applications\/([^/]+)/)) {
    jobId = req.path.match(/\/applications\/([^/]+)/)![1];
  }
  
  if (jobId && typeof jobId === 'string') {
     const row = db.prepare('SELECT b.zone_id FROM applications a JOIN businesses b ON a.business_id = b.id WHERE a.id = ?').get(jobId) as { zone_id: string } | undefined;
     if (!row) return false;
     return user.zone_id === null || user.zone_id === row.zone_id;
  }
  return true;
}

export function isAssignedOfficer(req: Request): boolean {
  const user = (req as unknown as Record<string, unknown>).user as { id: string } | undefined;
  if (!user) return false;
  
  let jobId = req.params.id || req.body.id || req.query.id;
  if (!jobId && req.path.match(/\/jobs\/([^/]+)/)) {
    jobId = req.path.match(/\/jobs\/([^/]+)/)![1];
  }
  if (!jobId && req.path.match(/\/applications\/([^/]+)/)) {
    jobId = req.path.match(/\/applications\/([^/]+)/)![1];
  }
  
  if (jobId && typeof jobId === 'string') {
     const row = db.prepare('SELECT officer_id FROM appointments WHERE application_id = ?').get(jobId) as { officer_id: string } | undefined;
     return row?.officer_id === user.id;
  }
  return true;
}

export function ownsAppointment(req: Request): boolean {
  const user = (req as unknown as Record<string, unknown>).user as { id: string } | undefined;
  if (!user) return false;
  
  const appId = req.body.applicationId;
  if (!appId) return false;
  
  const appointment = db.prepare('SELECT officer_id FROM appointments WHERE application_id = ?').get(appId) as { officer_id: string } | undefined;
  return appointment?.officer_id === user.id;
}

export function rbacMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) return next();

  // Extract base path, handle parameters roughly for matching
  const match = routeTable.find(r => {
    if (r.method !== req.method) return false;
    // Simple param matching, e.g. /api/demo/login-as/:role
    const regex = new RegExp('^' + r.path.replace(/:[^\s/]+/g, '([^/]+)') + '$');
    return regex.test(req.path);
  });

  if (!match) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
    return;
  }

  const userRole = (req as unknown as Record<string, unknown>).user 
    ? ((req as unknown as Record<string, unknown>).user as Record<string, unknown>).role as Role 
    : 'PUBLIC';
  
  if (!match.roles.includes(userRole) && !match.roles.includes('HMAC')) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Access denied' });
    return;
  }

  if (match.objectPolicy) {
    Promise.resolve(match.objectPolicy(req)).then(allowed => {
      if (!allowed) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Object access denied' });
      } else {
        next();
      }
    }).catch(next);
  } else {
    next();
  }
}
