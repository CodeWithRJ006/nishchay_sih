import { describe, it, expect } from 'vitest';
import express from 'express';
import { routeTable } from '../rbac/routeTable.js';
import { createApp } from '../app.js';

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

  it('test that fails when a mounted route is missing from the table', () => {
    const app = createApp();
    const stack = app._router.stack;
    
    // Find all explicitly mounted routes
    const mounted: { method: string, path: string }[] = [];
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods).filter(m => layer.route.methods[m]);
        for (const m of methods) {
          if (layer.route.path !== '/api/health') {
             mounted.push({ method: m.toUpperCase(), path: layer.route.path });
          }
        }
      }
    }

    for (const route of mounted) {
      if (route.path.startsWith('/api/') && !route.path.startsWith('/api/demo/') && !route.path.startsWith('/api/health')) {
        const match = routeTable.find(r => r.method === route.method && r.path === route.path);
        expect(match, `Mounted route ${route.method} ${route.path} is missing from routeTable!`).toBeDefined();
      }
    }
  });

  it('object-level helpers return true as scaffolded', async () => {
    const { ownsBusiness, inJurisdiction, isAssignedOfficer } = await import('../rbac/routeTable.js');
    const req = { user: { id: 'USR-BIZ1' }, params: {}, body: {}, query: {} } as unknown as express.Request;
    expect(ownsBusiness(req)).toBe(true);
    expect(inJurisdiction(req)).toBe(true);
    expect(isAssignedOfficer(req)).toBe(true);
  });
});
