import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { clock } from '../../shared/src/clock.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  process.env.DEMO_MODE = 'true';
  runMigrations();
  db.exec('DELETE FROM officer_rejections; DELETE FROM appointments; DELETE FROM application_documents; DELETE FROM inspection_photos; DELETE FROM inspections; DELETE FROM certificates; DELETE FROM receipts; DELETE FROM payments; DELETE FROM applications; DELETE FROM instruments; DELETE FROM businesses; DELETE FROM users; DELETE FROM counters;');
  seedDemoData();
  app = createApp() as Express;
  });

afterAll(() => {
  db.exec('DELETE FROM officer_rejections; DELETE FROM appointments; DELETE FROM application_documents; DELETE FROM inspection_photos; DELETE FROM inspections; DELETE FROM certificates; DELETE FROM receipts; DELETE FROM payments; DELETE FROM applications; DELETE FROM instruments; DELETE FROM businesses; DELETE FROM users; DELETE FROM counters;');
});

describe('Block 5b: Scheduling', () => {
  let bizToken: string;
  let adminToken: string;
  let lmo1Token: string;
  let gatcToken: string;
  
  let unsubmittedAppId: string;
  let paidAppId: string;

  beforeAll(async () => {
    let res = await request(app).post('/api/demo/login-as/BUSINESS');
    bizToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
    
    res = await request(app).post('/api/demo/login-as/ADMIN');
    adminToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];

    res = await request(app).post('/api/demo/login-as/LMO'); // This usually logs in LMO1
    lmo1Token = res.headers['set-cookie'][0].split(';')[0].split('=')[1];

    res = await request(app).post('/api/demo/login-as/GATC');
    gatcToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  beforeEach(() => {
    clock.now = () => Date.now();
  });

  it('scheduling before payment is rejected', async () => {
    // create unsubmitted app
    const instId = 'TEST-INST-B5-1';
    db.prepare('INSERT INTO instruments (id, business_id, type_code, serial, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(instId, 'BIZ-1', 'NAWI-3', 'SER-B5-1', 'Make', 'Model', '150kg');
      
    const appRes = await request(app).post('/api/applications').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ instrument_id: instId, documents: [{ doc_type: 'inv', file_name: 'test.pdf', file_hash: 'hash' }] });
    
    unsubmittedAppId = appRes.body.id;
    
    const schedRes = await request(app).post('/api/appointments/schedule').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: unsubmittedAppId, slotDate: '2030-01-01', slotTime: 'MORNING' });
      
    expect(schedRes.status).toBe(409); // Invalid transition
  });

  it('returns valid slots, none on Sunday', async () => {
    const res = await request(app).get('/api/appointments/slots').set('Cookie', `token=${bizToken}`);
    expect(res.status).toBe(200);
    const slots = res.body;
    expect(slots.length).toBe(10);
    
    slots.forEach((s: { date: string }) => {
      const day = new Date(s.date).getUTCDay();
      expect(day).not.toBe(0);
    });
  });

  it('timezone case: Saturday 19:00 UTC (Sunday in India) offers Monday as first slot', async () => {
    const { clock } = await import('../../shared/src/clock.js');
    const originalNow = clock.now;
    // 2026-10-03T19:00:00Z is Saturday UTC, Sunday IST
    clock.now = () => 1791054000000;
    
    const res = await request(app).get('/api/appointments/slots').set('Cookie', `token=${bizToken}`);
    clock.now = originalNow;
    
    expect(res.status).toBe(200);
    expect(res.body[0].date).toBe('2026-10-05'); // Monday
  });

  it('auto-assigns paid application and rejects second schedule', async () => {
    // create a PAID application for GATC
    const instId = 'TEST-INST-B5-2';
    db.prepare('INSERT INTO instruments (id, business_id, type_code, serial, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(instId, 'BIZ-1', 'NAWI-3', 'SER-B5-2', 'Make', 'Model', '150kg');
    const appRes = await request(app).post('/api/applications').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ instrument_id: instId, documents: [{ doc_type: 'inv', file_name: 'test.pdf', file_hash: 'hash' }] });
    paidAppId = appRes.body.id;
    
    db.prepare('UPDATE applications SET state = ? WHERE id = ?').run('PAID', paidAppId);
    
    const schedRes = await request(app).post('/api/appointments/schedule').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: paidAppId, slotDate: '2030-01-02', slotTime: 'MORNING' });
      
    expect(schedRes.status).toBe(200);
    expect(schedRes.body.officer_id).toBe('USR-GATC1');
    
    // second schedule returns 409
    const schedRes2 = await request(app).post('/api/appointments/schedule').set('Cookie', `token=${bizToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: paidAppId, slotDate: '2030-01-03', slotTime: 'AFTERNOON' });
    expect(schedRes2.status).toBe(409);
  });
  
  it('rejects an assignment, try reassignment', async () => {
  const rejectRes = await request(app).post('/api/appointments/reject').set('Cookie', `token=${gatcToken}`)
    .set('x-csrf-token', 'dummy')
    .send({ applicationId: paidAppId, reason: 'Busy' });
  
  expect(rejectRes.status).toBe(200);
  
  // It should now be reassigned to USR-GATC2
  const appState = db.prepare('SELECT state FROM applications WHERE id = ?').get(paidAppId) as { state: string };
  expect(appState.state).toBe('SCHEDULED');
  
  const apt = db.prepare('SELECT officer_id FROM appointments WHERE application_id = ?').get(paidAppId) as { officer_id: string };
  expect(apt.officer_id).toBe('USR-GATC2');
});

it('rejecting again sends it to unassigned queue, admin manual assignment', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'gatc2@nishchay.example', password: 'demo123' });
  const gatc2Token = res.headers['set-cookie'][0].split(';')[0].split('=')[1];

  const reject2 = await request(app).post('/api/appointments/reject').set('Cookie', `token=${gatc2Token}`)
    .set('x-csrf-token', 'dummy')
    .send({ applicationId: paidAppId, reason: 'Also Busy' });
  
  expect(reject2.status).toBe(200);

  const unRes = await request(app).get('/api/admin/unassigned-jobs').set('Cookie', `token=${adminToken}`);
  expect(unRes.body.find((a: { id: string }) => a.id === paidAppId)).toBeTruthy();

  const assignRes = await request(app).post('/api/admin/assign').set('Cookie', `token=${adminToken}`)
    .set('x-csrf-token', 'dummy')
    .send({ applicationId: paidAppId, officerId: 'USR-GATC1' });
    
  expect(assignRes.status).toBe(200);
  
  const appState2 = db.prepare('SELECT state FROM applications WHERE id = ?').get(paidAppId) as { state: string };
  expect(appState2.state).toBe('SCHEDULED');
});

it('two concurrent accepts only one succeeds', async () => {
  const p1 = request(app).post('/api/appointments/accept').set('Cookie', `token=${gatcToken}`)
    .set('x-csrf-token', 'dummy')
    .send({ applicationId: paidAppId });
    
  const p2 = request(app).post('/api/appointments/accept').set('Cookie', `token=${gatcToken}`)
    .set('x-csrf-token', 'dummy')
    .send({ applicationId: paidAppId });
    
  const [res1, res2] = await Promise.all([p1, p2]);
  const codes = [res1.status, res2.status];
  expect(codes).toContain(200);
  expect(codes).toContain(409);
});

it('wrong officer gets 403', async () => {
  const rejectRes = await request(app).post('/api/appointments/reject').set('Cookie', `token=${lmo1Token}`)
    .set('x-csrf-token', 'dummy')
    .send({ applicationId: paidAppId, reason: 'Nope' });
    
  expect(rejectRes.status).toBe(403);
});
});
