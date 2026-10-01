import { describe, it, expect } from 'vitest';
import express from 'express';
import { routeTable } from '../rbac/routeTable.js';

describe('RBAC Route Table', () => {
  it('should include all standard mounted routes', () => {
    const requiredRoutes = [
      { method: 'POST', path: '/api/auth/register' },
      { method: 'POST', path: '/api/auth/login' },
      { method: 'POST', path: '/api/auth/logout' },
      { method: 'GET', path: '/api/auth/me' },
      { method: 'POST', path: '/api/demo/login-as/:role' },
      { method: 'GET', path: '/api/public/keys' }
    ];

    for (const req of requiredRoutes) {
      const match = routeTable.find(r => r.method === req.method && r.path === req.path);
      expect(match).toBeDefined();
    }
  });

  it('object-level helpers return true as scaffolded', async () => {
    // Currently scaffolded as returning true
    const { ownsBusiness, inJurisdiction, isAssignedOfficer } = await import('../rbac/routeTable.js');
    expect(ownsBusiness({} as express.Request)).toBe(true);
    expect(inJurisdiction({} as express.Request)).toBe(true);
    expect(isAssignedOfficer({} as express.Request)).toBe(true);
  });
});
