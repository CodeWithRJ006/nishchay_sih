import { Request, Response, NextFunction } from 'express';

export type Role = 'ADMIN' | 'LMO' | 'GATC' | 'BUSINESS' | 'PUBLIC';

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
  { method: 'GET', path: '/api/auth/me', roles: ['BUSINESS', 'LMO', 'GATC', 'ADMIN'] },
  { method: 'POST', path: '/api/demo/login-as/:role', roles: ['PUBLIC'] },
  { method: 'GET', path: '/api/public/keys', roles: ['PUBLIC'] },
  { method: 'GET', path: '/api/health', roles: ['PUBLIC'] },
];

export function ownsBusiness(_req: Request): boolean {
  return true; // TODO: implement object checks
}
export function inJurisdiction(_req: Request): boolean {
  return true;
}
export function isAssignedOfficer(_req: Request): boolean {
  return true;
}

export function rbacMiddleware(req: Request, res: Response, next: NextFunction) {
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
  
  if (!match.roles.includes(userRole)) {
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
