import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import crypto from 'node:crypto';
import { routeTable } from '../rbac/routeTable.js';
import { hmacSecret } from '../config/secrets.js';

describe('Demo Pay Shortcut', () => {
  const app = createApp();
  let bizToken1: string;
  let bizToken2: string;
  let biz2AppId: string;
  let biz2PaymentId: string;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    const { runMigrations } = await import('../db/migrate.js');
    const { seedDemoData } = await import('../scripts/seed.js');
    runMigrations();
    seedDemoData();
    
    // biz1 login
    let res = await request(app).post('/api/demo/login-as/BUSINESS');
    bizToken1 = res.headers['set-cookie'][0].split(';')[0].split('=')[1];

    // biz2 login (need another business to test ownership)
    const biz2 = db.prepare("SELECT role FROM users WHERE email = 'biz2@nishchay.example'").get();
    if (biz2) {
      res = await request(app).post('/api/auth/login').send({ email: 'biz2@nishchay.example', password: 'demo123' });
      bizToken2 = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
    } else {
      res = await request(app).post('/api/auth/register').send({ email: 'biz2@test.com', password: 'password', name: 'biz2', address: 'addr' });
      res = await request(app).post('/api/auth/login').send({ email: 'biz2@test.com', password: 'password' });
      bizToken2 = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
    }

    // Setup a payment for biz2
    // 1. Create instrument
    let apiRes = await request(app).post('/api/instruments').set('Cookie', [`token=${bizToken2}`]).set('x-csrf-token', 'dummy')
      .send({ type_code: 'NAWI-3', make: 'Make', model: 'Model', serial: 'SN-DEMO-' + Date.now(), capacity: '10kg', class: 'Class II' });
    expect(apiRes.status).toBe(201);
    const instId = apiRes.body.id;
    // 2. Apply
    apiRes = await request(app).post('/api/applications').set('Cookie', [`token=${bizToken2}`]).set('x-csrf-token', 'dummy')
      .send({ instrument_id: instId, documents: [{ doc_type: 'Invoice', file_name: 'test.pdf', file_hash: 'hash' }] });
    expect(apiRes.status).toBe(201);
    biz2AppId = apiRes.body.id;
    // 3. Initiate payment
    apiRes = await request(app).post('/api/payments/initiate').set('Cookie', [`token=${bizToken2}`]).set('x-csrf-token', 'dummy')
      .send({ applicationId: biz2AppId, amount: 500 });
    expect(apiRes.status).toBe(200);
    biz2PaymentId = apiRes.body.paymentId;
  });

  it('route-table test: no non-GET route whose path contains /demo has the PUBLIC role, except POST /api/demo/login-as/:role', () => {
    const demoRoutes = routeTable.filter(r => r.path.includes('/demo'));
    for (const route of demoRoutes) {
      if (route.method !== 'GET' && route.path !== '/api/demo/login-as/:role') {
        expect(route.roles.includes('PUBLIC')).toBe(false);
      }
    }
  });

  it('no session gives 403', async () => {
    const res = await request(app).post('/api/demo/trigger-callback')
      .set('x-csrf-token', 'dummy')
      .send({ paymentId: biz2PaymentId });
    expect(res.status).toBe(403);
  });

  it('another businesss payment gives 403', async () => {
    const res = await request(app).post('/api/demo/trigger-callback')
      .set('Cookie', [`token=${bizToken1}`]) 
      .set('x-csrf-token', 'dummy')
      .send({ paymentId: biz2PaymentId });
    expect(res.status).toBe(403);
  });

  it('DEMO_MODE off gives 404', async () => {
    process.env.DEMO_MODE = 'false';
    const res = await request(app).post('/api/demo/trigger-callback')
      .set('Cookie', [`token=${bizToken2}`])
      .set('x-csrf-token', 'dummy')
      .send({ paymentId: biz2PaymentId });
    expect(res.status).toBe(404);
    process.env.DEMO_MODE = 'true';
  });

  it('a successful call returns PAID with a receipt and writes a DEMO_TOOL audit row', async () => {
    const res = await request(app).post('/api/demo/trigger-callback')
      .set('Cookie', [`token=${bizToken2}`])
      .set('x-csrf-token', 'dummy')
      .send({ paymentId: biz2PaymentId, amount: 9999, status: 'FAILURE', timestamp: 0 });
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PAID');
    expect(res.body.receiptId).toBeDefined();

    const audit = db.prepare("SELECT * FROM audit_log WHERE action = 'DEMO_TOOL' AND record_id = ?").get(biz2AppId);
    expect(audit).toBeDefined();
  });

  it('an already-paid payment gives 409', async () => {
    const res = await request(app).post('/api/demo/trigger-callback')
      .set('Cookie', [`token=${bizToken2}`])
      .set('x-csrf-token', 'dummy')
      .send({ paymentId: biz2PaymentId });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('a real signed POST /api/payments/callback still works', async () => {
    const iRes = await request(app).post('/api/instruments').set('Cookie', [`token=${bizToken2}`]).set('x-csrf-token', 'dummy')
      .send({ type_code: 'NAWI-3', make: 'Make', model: 'Model', serial: 'SN-DEMO-2-' + Date.now(), capacity: '10kg', class: 'Class II' });
    const instId2 = iRes.body.id;
    const apiRes = await request(app).post('/api/applications').set('Cookie', [`token=${bizToken2}`]).set('x-csrf-token', 'dummy')
      .send({ instrument_id: instId2, documents: [{ doc_type: 'Invoice', file_name: 't2.pdf', file_hash: 'hash' }] });
    const appId2 = apiRes.body.id;
    
    const initRes = await request(app).post('/api/payments/initiate').set('Cookie', [`token=${bizToken2}`]).set('x-csrf-token', 'dummy')
      .send({ applicationId: appId2, amount: 500 });
    const pId2 = initRes.body.paymentId;

    const body = {
      paymentId: pId2,
      status: 'SUCCESS' as const,
      amount: 500,
      timestamp: Date.now(),
      applicationId: appId2
    };

    const hmac = crypto.createHmac('sha256', hmacSecret());
    hmac.update(`${body.paymentId}:${body.status}:${body.amount}:${body.timestamp}:${body.applicationId}`);
    const signature = hmac.digest('hex');

    const cb = await request(app).post('/api/payments/callback')
      .set('x-hmac-signature', signature)
      .send(body);
    expect(cb.status).toBe(200);
    expect(cb.body.status).toBe('PAID');
  });

  it('a callback with a wrong signature is rejected', async () => {
    const body = {
      paymentId: 'dummy-pid',
      status: 'SUCCESS' as const,
      amount: 500,
      timestamp: Date.now(),
      applicationId: 'dummy-aid'
    };
    const cb = await request(app).post('/api/payments/callback')
      .set('x-hmac-signature', 'bad-signature')
      .send(body);
    expect(cb.status).not.toBe(200);
  });
});
