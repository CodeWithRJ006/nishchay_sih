import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import { clock } from '../../shared/src/clock.js';
import type { Express } from 'express';

describe('Demo Tamper Auto-Restore', () => {
  const DEMO_CERT_VALID = 'sample-cert-val1d-0000';
  let app: Express;
  let adminCookie: string[];
  const realNow = clock.now;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    runMigrations();
    seedDemoData();
    app = createApp();
    const loginRes = await request(app).post('/api/demo/login-as/ADMIN');
    adminCookie = (loginRes.headers['set-cookie'] as unknown) as string[];
  });

  afterAll(() => {
    clock.now = realNow;
  });

  it('refuses to tamper a non-sample id', async () => {
    const res = await request(app)
      .post('/api/admin/demo/tamper')
      .set('Cookie', adminCookie)
      .set('x-csrf-token', 'test')
      .send({ publicId: 'NSH-C-2026-999999' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only sample demonstrator certificates can be tampered');
  });

  it('tamper, advance 119 s (still SEAL_BROKEN), advance to 121 s (back to VALID)', async () => {
    const baseTime = 1791000000000;
    clock.now = () => baseTime;

    // 1. Tamper valid sample certificate
    const tamperRes = await request(app)
      .post('/api/admin/demo/tamper')
      .set('Cookie', adminCookie)
      .set('x-csrf-token', 'test')
      .send({ publicId: DEMO_CERT_VALID });
    expect(tamperRes.status).toBe(200);

    // 2. Immediate check
    const statusImmediate = await request(app)
      .get(`/api/admin/demo/tamper-status?publicId=${DEMO_CERT_VALID}`)
      .set('Cookie', adminCookie);
    expect(statusImmediate.body.isTampered).toBe(true);

    const verifyImmediate = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(verifyImmediate.body.status).toBe('SEAL_BROKEN');
    expect(verifyImmediate.body.integrity).toBe(false);

    // 3. Advance 119 s -> still SEAL_BROKEN
    clock.now = () => baseTime + 119 * 1000;

    const verify119 = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(verify119.body.status).toBe('SEAL_BROKEN');
    expect(verify119.body.integrity).toBe(false);

    const status119 = await request(app)
      .get(`/api/admin/demo/tamper-status?publicId=${DEMO_CERT_VALID}`)
      .set('Cookie', adminCookie);
    expect(status119.body.isTampered).toBe(true);

    // 4. Advance to 121 s -> auto-restores to VALID
    clock.now = () => baseTime + 121 * 1000;

    const verify121 = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(verify121.body.status).toBe('VALID');
    expect(verify121.body.integrity).toBe(true);

    const status121 = await request(app)
      .get(`/api/admin/demo/tamper-status?publicId=${DEMO_CERT_VALID}`)
      .set('Cookie', adminCookie);
    expect(status121.body.isTampered).toBe(false);
  });

  it('restores tampered record across a simulated restart', async () => {
    const baseTime = 1791000000000;
    clock.now = () => baseTime;

    // Tamper
    const tamperRes = await request(app)
      .post('/api/admin/demo/tamper')
      .set('Cookie', adminCookie)
      .set('x-csrf-token', 'test')
      .send({ publicId: DEMO_CERT_VALID });
    expect(tamperRes.status).toBe(200);

    // Advance 130 s
    clock.now = () => baseTime + 130 * 1000;

    // Simulate restart with new app instance
    const restartedApp = createApp();
    const verifyRes = await request(restartedApp).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(verifyRes.body.status).toBe('VALID');
    expect(verifyRes.body.integrity).toBe(true);
  });
});
