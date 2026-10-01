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
  db.exec('DELETE FROM officer_rejections; DELETE FROM appointments; DELETE FROM application_documents; DELETE FROM certificates; DELETE FROM receipts; DELETE FROM payments; DELETE FROM applications; DELETE FROM instruments; DELETE FROM businesses; DELETE FROM users; DELETE FROM counters;');
  seedDemoData();
  app = createApp() as Express;
  const schemaInfo = db.pragma('table_info(appointments)');
  console.log('appointments schema:', schemaInfo);
});

afterAll(() => {
  db.exec('DELETE FROM officer_rejections; DELETE FROM appointments; DELETE FROM application_documents; DELETE FROM certificates; DELETE FROM receipts; DELETE FROM payments; DELETE FROM applications; DELETE FROM instruments; DELETE FROM businesses; DELETE FROM users; DELETE FROM counters;');
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
    
    // It should now be in UNASSIGNED queue because we only have 1 GATC officer!
    const appState = db.prepare('SELECT state FROM applications WHERE id = ?').get(paidAppId) as { state: string };
    expect(appState.state).toBe('PAID');
    
    const unRes = await request(app).get('/api/admin/unassigned-jobs').set('Cookie', `token=${adminToken}`);
    expect(unRes.body.find((a: { id: string }) => a.id === paidAppId)).toBeTruthy();
  });
  
  it('admin manual assignment', async () => {
    const assignRes = await request(app).post('/api/admin/assign').set('Cookie', `token=${adminToken}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: paidAppId, officerId: 'USR-GATC1' });
      
    expect(assignRes.status).toBe(200);
    
    const appState = db.prepare('SELECT state FROM applications WHERE id = ?').get(paidAppId) as { state: string };
    expect(appState.state).toBe('SCHEDULED');
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
    // LMO tries to accept GATC's job
    const acceptRes = await request(app).post('/api/appointments/accept').set('Cookie', `token=${lmo1Token}`)
      .set('x-csrf-token', 'dummy')
      .send({ applicationId: paidAppId });
      
    expect(acceptRes.status).toBe(403);
  });

});
