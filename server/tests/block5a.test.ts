import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import crypto from 'node:crypto';
import { clock } from '../../shared/src/clock.js';
import { checkFeeGate } from '../services/paymentsService.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  process.env.DEMO_MODE = 'true';
  runMigrations();
  db.exec('DELETE FROM application_documents; DELETE FROM certificates; DELETE FROM receipts; DELETE FROM payments; DELETE FROM applications; DELETE FROM instruments; DELETE FROM businesses; DELETE FROM users; DELETE FROM counters;');
  seedDemoData();
  app = createApp() as Express;
});

afterAll(() => {
  db.exec('DELETE FROM application_documents; DELETE FROM certificates; DELETE FROM receipts; DELETE FROM payments; DELETE FROM applications; DELETE FROM instruments; DELETE FROM businesses; DELETE FROM users; DELETE FROM counters;');
});

describe('Block 5a: Payments and Fee-Gate', () => {
  let bizToken: string;
  let instrumentId: string;
  let appId: string;

  beforeAll(async () => {
    // Get BIZ token
    const res = await request(app).post('/api/demo/login-as/BUSINESS');
    bizToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  beforeEach(() => {
    // reset clock
    clock.now = () => Date.now();
  });

  it('seeded data passes the gate', () => {
    // app2 is INSPECTED_PASS
    const apps = db.prepare("SELECT id FROM applications WHERE state = 'INSPECTED_PASS'").all() as {id:string}[];
    expect(apps.length).toBeGreaterThan(0);
    for (const a of apps) {
      expect(checkFeeGate(a.id)).toBe(true);
    }
  });

  it('rejects forged signature', async () => {
    // insert a new instrument
    instrumentId = 'TEST-INST-' + Date.now();
    db.prepare('INSERT INTO instruments (id, business_id, type_code, serial, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(instrumentId, 'BIZ-1', 'NAWI-3', 'SERIAL-' + Date.now(), 'Make', 'Model', '150kg');
    
    const appRes = await request(app).post('/api/applications').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ instrument_id: instrumentId, documents: [{ doc_type: 'Invoice', file_name: 'test.pdf', file_hash: 'hash' }] });
    
    appId = appRes.body.id;
    
    // initiate payment
    const initRes = await request(app).post('/api/payments/initiate').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: appId, amount: 500 });
      
    expect(initRes.status).toBe(200);
    const paymentId = initRes.body.paymentId;
    
    // Forge signature
    const body = {
      paymentId,
      status: 'SUCCESS',
      amount: 500,
      timestamp: Date.now(),
      applicationId: appId
    };
    
    const cb = await request(app).post('/api/payments/callback')
      .set('x-hmac-signature', 'forged-hash')
      .send(body);
      
    expect(cb.status).not.toBe(200);
  });
  
  it('50 parallel identical callbacks produce exactly one receipt', async () => {
    const initRes = await request(app).post('/api/payments/initiate').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: appId, amount: 500 });
    const paymentId = initRes.body.paymentId;
    
    const body = {
      paymentId,
      status: 'SUCCESS' as const,
      amount: 500,
      timestamp: Date.now(),
      applicationId: appId
    };
    
    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(`${body.paymentId}:${body.status}:${body.amount}:${body.timestamp}:${body.applicationId}`);
    const signature = hmac.digest('hex');
    
    const promises = [];
    for(let i=0; i<50; i++) {
      promises.push(
        request(app).post('/api/payments/callback')
          .set('x-hmac-signature', signature)
          .send(body)
      );
    }
    
    await Promise.all(promises);
    
    const receipts = db.prepare('SELECT * FROM receipts WHERE payment_id = ?').all(paymentId);
    expect(receipts.length).toBe(1);
    
    const appRecord = db.prepare('SELECT state FROM applications WHERE id = ?').get(appId) as { state: string };
    expect(appRecord.state).toBe('PAID');
  });

  it('rejects replay after 15 minutes', async () => {
    // create a new app
    const i2 = 'TEST-INST-' + Date.now();
    db.prepare('INSERT INTO instruments (id, business_id, type_code, serial, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(i2, 'BIZ-1', 'NAWI-3', 'SERIAL-' + Date.now(), 'Make', 'Model', '150kg');
    const aRes = await request(app).post('/api/applications').set('Cookie', `token=${bizToken}`).set('x-csrf-token', 'dummy')
      .send({ instrument_id: i2, documents: [{ doc_type: 'Invoice', file_name: 't.pdf', file_hash: 'hash' }] });
    const aId = aRes.body.id;

    const init = await request(app).post('/api/payments/initiate').set('Cookie', `token=${bizToken}`).set('x-csrf-token', 'dummy')
      .send({ applicationId: aId, amount: 500 });
    const pId = init.body.paymentId;

    const body = {
      paymentId: pId,
      status: 'SUCCESS' as const,
      amount: 500,
      timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      applicationId: aId
    };

    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(`${body.paymentId}:${body.status}:${body.amount}:${body.timestamp}:${body.applicationId}`);
    const signature = hmac.digest('hex');

    const cb = await request(app).post('/api/payments/callback')
      .set('x-hmac-signature', signature)
      .send(body);
    expect([400,403,500]).toContain(cb.status); // Bad request or forbidden because of timestamp
  });

  // checkFeeGate unit tests
  it('gate fails on wrong state', () => {
    // appId is PAID
    const res = checkFeeGate(appId);
    expect(res).toBe(false);
  });
});
