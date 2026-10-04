import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData, DEMO_CERT_VALID } from '../scripts/seed.js';
import { routeTable } from '../rbac/routeTable.js';
import crypto from 'node:crypto';

describe('Block D - Smaller defects & completeness', () => {
  const app = createApp();

  beforeAll(() => {
    runMigrations();
    seedDemoData();
  });

  it('rejects payment callback with bad signature with 401', async () => {
    const body = {
      paymentId: 'PAY-D1',
      status: 'SUCCESS' as const,
      amount: 100,
      timestamp: Date.now(),
      applicationId: 'APP-D1'
    };

    const res = await request(app)
      .post('/api/payments/callback')
      .set('x-hmac-signature', 'bad-signature-hex')
      .send(body);

    expect(res.status).toBe(401);
  });

  it('rejects payment callback with stale timestamp with 400', async () => {
    const expiredTimestamp = Date.now() - (20 * 60 * 1000); // 20 minutes ago (> 15m)
    const body = {
      paymentId: 'PAY-D2',
      status: 'SUCCESS' as const,
      amount: 100,
      timestamp: expiredTimestamp,
      applicationId: 'APP-D2'
    };

    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(`${body.paymentId}:${body.status}:${body.amount}:${body.timestamp}:${body.applicationId}`);
    const signature = hmac.digest('hex');

    const res = await request(app)
      .post('/api/payments/callback')
      .set('x-hmac-signature', signature)
      .send(body);

    expect(res.status).toBe(400);
  });

  it('rejects complaint with invalid category with 400', async () => {
    const res = await request(app)
      .post(`/api/certificates/${DEMO_CERT_VALID}/complaint`)
      .set('x-csrf-token', 'dummy')
      .send({
        category: 'INVALID_CATEGORY_ARBITRARY',
        note: 'Some note'
      });

    expect(res.status).toBe(400);
  });

  it('returns 404 when filing a complaint on a non-existent certificate', async () => {
    const res = await request(app)
      .post('/api/certificates/non-existent-public-id-9999/complaint')
      .set('x-csrf-token', 'dummy')
      .send({
        category: 'BILLING',
        note: 'Some note'
      });

    expect(res.status).toBe(404);
  });

  it('returns human-readable instrumentType from rules.ts in public verify', async () => {
    const res = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(res.status).toBe(200);
    // DEMO_CERT_VALID is for W-1 which is 'Weights'
    expect(res.body.instrumentType).toBe('Weights');
  });

  it('asserts every mounted Express API route appears in routeTable.ts with explicit policy', () => {
    const expressApp = app as unknown as { _router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } };
    const stack = expressApp._router.stack;
    const mountedRoutes: { method: string; path: string }[] = [];

    stack.forEach(layer => {
      if (layer.route && typeof layer.route.path === 'string') {
        const routePath = layer.route.path;
        if (routePath.startsWith('/api')) {
          Object.keys(layer.route.methods).forEach(m => {
            if (layer.route?.methods[m]) {
              mountedRoutes.push({ method: m.toUpperCase(), path: routePath });
            }
          });
        }
      }
    });

    expect(mountedRoutes.length).toBeGreaterThan(0);

    for (const r of mountedRoutes) {
      // Find matching route in routeTable
      const found = routeTable.find(entry => {
        if (entry.method !== r.method) return false;
        if (entry.path === r.path) return true;
        // Check param pattern match e.g. /:publicId vs /:id
        const regex1 = new RegExp('^' + entry.path.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)') + '$');
        const regex2 = new RegExp('^' + r.path.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)') + '$');
        return regex1.test(r.path) || regex2.test(entry.path);
      });

      if (!found) {
        throw new Error(`Mounted Express route [${r.method} ${r.path}] is NOT declared in routeTable.ts`);
      }
      expect(found.roles.length).toBeGreaterThan(0);
    }
  });
});
