import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import crypto from 'crypto';

describe('Block 6b Tests', () => {
  const app = createApp();
  let lmoToken: string;
  let gatcToken: string;
  let testAppId: string;

  beforeAll(async () => {
    const { runMigrations } = await import('../db/migrate.js');
    const { seedDemoData } = await import('../scripts/seed.js');
    runMigrations();
    seedDemoData();
    
    let res = await request(app).post('/api/auth/login').send({ email: 'lmo1@nishchay.gov.in', password: 'demo123' });
    lmoToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];

    res = await request(app).post('/api/auth/login').send({ email: 'gatc1@nishchay.gov.in', password: 'demo123' });
    gatcToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  it('sets up a job for testing', async () => {
    // create a job explicitly for testing
    testAppId = 'APP-6B-' + Date.now();
    db.prepare("INSERT INTO businesses (id, owner_id, name, email, phone, address, type, zone_id, lat, lng) VALUES ('BIZ-6B', 'USR-BIZ1', 'Test', 't@t.com', '123', 'addr', 'MANUFACTURER', 'ZONE-1', 0, 0)").run();
    db.prepare("INSERT INTO applications (id, business_id, instrument_id, state, fee_amount) VALUES (?, 'BIZ-6B', 'NSH-I-000001', 'ACCEPTED', 500)").run(testAppId);
    db.prepare("INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (?, ?, 'USR-LMO1', '2026-10-10', 'Morning', 'ACCEPTED')").run('APT-' + testAppId, testAppId);
    // Add payment and receipt for fee gate
    const receiptId = 'REC-' + testAppId;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19); // sqlite format
    const payload = `${receiptId}:${testAppId}:NSH-I-000001:500:${nowStr}`;
    const sig = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret').update(payload).digest('hex');
    db.prepare("INSERT INTO payments (id, application_id, amount, status, idempotency_key) VALUES (?, ?, 500, 'PAID', 'test-key')").run('PAY-6B', testAppId);
    db.prepare("INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, 'PAY-6B', 500, ?, ?)").run(receiptId, testAppId, sig, nowStr);
  });

  it('rejects inspection if officer not assigned', async () => {
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${gatcToken}`])
      .set('x-csrf-token', 'dummy');
    expect(res.status).toBe(403);
  });

  it('rejects inspection if not ARRIVED', async () => {
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', '[]')
      .field('pass', 'true')
      .field('reasons', '[]');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ARRIVED/);
  });

  it('arrives successfully', async () => {
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/arrive`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .send({ lat: 0, lng: 0, overrideMode: true });
    expect(res.status).toBe(200);
  });

  it('rejects submit without photos', async () => {
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', '[]')
      .field('pass', 'true');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 photos/);
  });

  it('rejects non-image bytes', async () => {
    const fakeBuffer = Buffer.from('hello world not an image');
    const hash = crypto.createHash('sha256').update(fakeBuffer).digest('hex');
    
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', '[]')
      .field('pass', 'true')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .attach('files', fakeBuffer, 'a.txt')
      .attach('files', fakeBuffer, 'b.txt');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JPEG or PNG/);
  });

  it('rejects hash mismatch', async () => {
    // Generate valid JPEG bytes
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60]);
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', '[]')
      .field('pass', 'true')
      .field('clientHashes', JSON.stringify(['badhash1', 'badhash2']))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, '1.jpg')
      .attach('files', fakeJpeg, '2.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Hash mismatch/);
  });

  it('rejects FAIL without reason', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', '[]')
      .field('pass', 'false')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, '1.jpg')
      .attach('files', fakeJpeg, '2.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/FAIL requires at least one reason/);
  });

  it('rejects PASS override without reason', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');
    // Instrument is NAWI-3 (or W-1 from seed). We inserted NSH-I-000001 which is W-1 (tolerance 5).
    const readings = [{ applied: 100, observed: 151 }]; // Error 51 > 50 -> Fail

    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', JSON.stringify(readings))
      .field('pass', 'true')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, '1.jpg')
      .attach('files', fakeJpeg, '2.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/PASS override requires a reason/);
  });

  it('submits successfully', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');
    const readings = [{ applied: 100, observed: 101 }]; // Error 1 < 5 -> Pass

    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', JSON.stringify([true, true, true]))
      .field('readings', JSON.stringify(readings))
      .field('pass', 'true')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, '1.jpg')
      .attach('files', fakeJpeg, '2.jpg');
    expect(res.status).toBe(200);

    const appRow = db.prepare('SELECT state FROM applications WHERE id = ?').get(testAppId) as { state: string };
    expect(appRow.state).toBe('CERTIFIED');
  });

  it('rejects double submit', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');
    
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', '[]')
      .field('readings', '[]')
      .field('pass', 'true')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, '1.jpg')
      .attach('files', fakeJpeg, '2.jpg');
    expect(res.status).toBe(409); // Either application not ACCEPTED or unique constraint
  });
});
