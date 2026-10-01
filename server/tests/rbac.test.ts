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

  it('object-level helpers enforce access control', async () => {
    const { ownsBusiness, inJurisdiction, isAssignedOfficer } = await import('../rbac/routeTable.js');
    const { db } = await import('../db/index.js');
    const { runMigrations } = await import('../db/migrate.js');
    const { seedDemoData } = await import('../scripts/seed.js');
    
    runMigrations();
    seedDemoData();
    
    // Find businesses
    const b1 = db.prepare('SELECT * FROM businesses WHERE id = ?').get('BIZ-3') as { id: string, owner_id: string, zone_id: string };
    const b2 = db.prepare('SELECT * FROM businesses WHERE id = ?').get('BIZ-2') as { id: string, owner_id: string, zone_id: string };
    
    // Find applications
    const apps = db.prepare('SELECT * FROM applications').all() as { id: string, business_id: string }[];
    const appB1 = apps.find(a => a.business_id === b1.id)!;
    
    // Create an appointment for appB1 assigned to LMO1
    const lmo1 = db.prepare("SELECT * FROM users WHERE id = 'USR-LMO1'").get() as { id: string, zone_id: string };
    const lmo2 = db.prepare("SELECT * FROM users WHERE id = 'USR-LMO2'").get() as { id: string, zone_id: string };
    
    db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('APT-TEST', appB1.id, lmo1.id, '2025-01-01', 'Morning', Date.now(), 'SCHEDULED');

    // business A cannot act on business B's application
    const req1 = { user: { id: b1.owner_id }, params: { id: b1.id }, body: {}, query: {} } as unknown as express.Request;
    const req2 = { user: { id: b2.owner_id }, params: { id: b1.id }, body: {}, query: {} } as unknown as express.Request;
    expect(ownsBusiness(req1)).toBe(true);
    expect(ownsBusiness(req2)).toBe(false);

    // an officer outside the zone cannot see the job (assuming b1 is in ZONE-1 and lmo1 is ZONE-1)
    const reqO1 = { user: { id: lmo1.id, zone_id: lmo1.zone_id }, params: { id: appB1.id }, body: {}, query: {} } as unknown as express.Request;
    const reqO2 = { user: { id: lmo2.id, zone_id: lmo2.zone_id }, params: { id: appB1.id }, body: {}, query: {} } as unknown as express.Request;
    expect(inJurisdiction(reqO1)).toBe(true);
    expect(inJurisdiction(reqO2)).toBe(false);

    // an unassigned officer cannot accept it
    expect(isAssignedOfficer(reqO1)).toBe(true);
    expect(isAssignedOfficer(reqO2)).toBe(false);
  });
});
