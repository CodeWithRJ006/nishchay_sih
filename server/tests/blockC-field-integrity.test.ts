import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import crypto from 'node:crypto';
import { verifyFullSeal } from '../seal/verifyFull.js';
import { haversine } from '../../shared/src/haversine.js';

describe('Block C - Field verification integrity', () => {
  const app = createApp();
  let lmoToken: string;
  let testAppId: string;
  let testPublicId: string;

  beforeAll(async () => {
    runMigrations();
    seedDemoData();

    // Login as LMO
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lmo1@nishchay.example', password: 'demo123' });
    const setCookie = loginRes.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : (typeof setCookie === 'string' ? [setCookie] : []);
    const rawCookie = cookies.find((c: string) => c.startsWith('token=')) || cookies[0];
    lmoToken = rawCookie?.split(';')[0]?.replace('token=', '') || '';

    // Create a new application with payment and arrived appointment
    testAppId = 'APP-BLOCKC-01';
    const biz = db.prepare('SELECT id FROM businesses LIMIT 1').get() as { id: string };
    const inst = db.prepare("SELECT id FROM instruments WHERE business_id = ? AND type_code = 'W-1' LIMIT 1").get(biz.id) as { id: string };

    db.prepare(`
      INSERT OR REPLACE INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule)
      VALUES (?, ?, ?, 'ACCEPTED', 100, 'LMO')
    `).run(testAppId, biz.id, inst.id);

    db.prepare(`
      INSERT OR REPLACE INTO payments (id, application_id, idempotency_key, amount, status)
      VALUES (?, ?, ?, 100, 'PAID')
    `).run('PAY-BLOCKC-01', testAppId, 'idem-blockc-01');

    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    const nowIso = new Date().toISOString();
    hmac.update(`REC-BLOCKC-01:${testAppId}:${inst.id}:100:${nowIso}`);
    const sig = hmac.digest('hex');

    db.prepare(`
      INSERT OR REPLACE INTO receipts (id, application_id, payment_id, amount, signature, created_at)
      VALUES (?, ?, ?, 100, ?, ?)
    `).run('REC-BLOCKC-01', testAppId, 'PAY-BLOCKC-01', sig, nowIso);

    db.prepare(`
      INSERT OR REPLACE INTO appointments (id, application_id, officer_id, slot_date, slot_time, status)
      VALUES (?, ?, 'USR-LMO1', '2026-10-10', '09:00', 'ACCEPTED')
    `).run('APT-BLOCKC-01', testAppId);
  });

  it('calculates Haversine distance correctly with two known coordinates', () => {
    // Distance along 1 degree of longitude at equator ~ 111,195 m
    const dEquator = haversine(0, 0, 0, 1);
    expect(dEquator).toBeGreaterThan(111000);
    expect(dEquator).toBeLessThan(112000);

    // Known Hyderabad coordinates: Charminar (17.3616, 78.4747) to Golconda Fort (17.3833, 78.4011) ~ 8.1 km
    const dHyd = haversine(17.3616, 78.4747, 17.3833, 78.4011);
    expect(dHyd).toBeGreaterThan(8000);
    expect(dHyd).toBeLessThan(8300);

    // Same point should be 0
    expect(haversine(17.3850, 78.4867, 17.3850, 78.4867)).toBe(0);
  });

  it('records arrived GPS and calculates distance when officer arrives', async () => {
    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/arrive`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .send({ lat: 17.3855, lng: 78.4870, is_demo_location: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.arrived_lat).toBe(17.3855);
    expect(res.body.arrived_lng).toBe(78.4870);
    expect(typeof res.body.arrived_distance).toBe('number');
    expect(res.body.is_demo_location).toBe(false);

    const apt = db.prepare('SELECT status, arrived_lat, arrived_lng, arrived_distance, is_demo_location FROM appointments WHERE application_id = ?').get(testAppId) as Record<string, unknown>;
    expect(apt.status).toBe('ARRIVED');
    expect(apt.arrived_lat).toBe(17.3855);
    expect(apt.arrived_lng).toBe(78.4870);
  });

  it('sets is_demo_location=true and distance to 12m when using demo GPS', async () => {
    // Reset status to ACCEPTED for demo arrive test
    db.prepare("UPDATE appointments SET status = 'ACCEPTED' WHERE application_id = ?").run(testAppId);

    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/arrive`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .send({ is_demo_location: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.is_demo_location).toBe(true);
    expect(res.body.arrived_distance).toBe(12);

    const apt = db.prepare('SELECT status, arrived_distance, is_demo_location FROM appointments WHERE application_id = ?').get(testAppId) as Record<string, unknown>;
    expect(apt.status).toBe('ARRIVED');
    expect(apt.arrived_distance).toBe(12);
    expect(apt.is_demo_location).toBe(1);
  });

  it('rejects inspection with 0 readings and state remains ACCEPTED', async () => {
    // Create separate test app
    const appZeroId = 'APP-ZERO-READINGS';
    const biz = db.prepare('SELECT id FROM businesses LIMIT 1').get() as { id: string };
    const inst = db.prepare("SELECT id FROM instruments WHERE business_id = ? AND type_code = 'W-1' LIMIT 1").get(biz.id) as { id: string };

    db.prepare(`
      INSERT OR REPLACE INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule)
      VALUES (?, ?, ?, 'ACCEPTED', 100, 'LMO')
    `).run(appZeroId, biz.id, inst.id);

    db.prepare(`
      INSERT OR REPLACE INTO appointments (id, application_id, officer_id, slot_date, slot_time, status)
      VALUES (?, ?, 'USR-LMO1', '2026-10-10', '09:00', 'ARRIVED')
    `).run('APT-ZERO', appZeroId);

    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');

    const res = await request(app)
      .post(`/api/field/jobs/${appZeroId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', JSON.stringify([true, true, true]))
      .field('readings', JSON.stringify([]))
      .field('pass', 'true')
      .field('reasons', '[]')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, 'photo1.jpg')
      .attach('files', fakeJpeg, 'photo2.jpg');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/At least 3 readings are required/i);

    const appRow = db.prepare('SELECT state FROM applications WHERE id = ?').get(appZeroId) as { state: string };
    expect(appRow.state).toBe('ACCEPTED');

    const inspRow = db.prepare('SELECT id FROM inspections WHERE application_id = ?').get(appZeroId);
    expect(inspRow).toBeUndefined();
  });

  it('rejects inspection with non-finite readings and state remains ACCEPTED', async () => {
    const appInvalidId = 'APP-INVALID-READINGS';
    const biz = db.prepare('SELECT id FROM businesses LIMIT 1').get() as { id: string };
    const inst = db.prepare("SELECT id FROM instruments WHERE business_id = ? AND type_code = 'W-1' LIMIT 1").get(biz.id) as { id: string };

    db.prepare(`
      INSERT OR REPLACE INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule)
      VALUES (?, ?, ?, 'ACCEPTED', 100, 'LMO')
    `).run(appInvalidId, biz.id, inst.id);

    db.prepare(`
      INSERT OR REPLACE INTO appointments (id, application_id, officer_id, slot_date, slot_time, status)
      VALUES (?, ?, 'USR-LMO1', '2026-10-10', '09:00', 'ARRIVED')
    `).run('APT-INVALID', appInvalidId);

    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');

    const res = await request(app)
      .post(`/api/field/jobs/${appInvalidId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', JSON.stringify([true, true, true]))
      .field('readings', JSON.stringify([{ applied: 'not_a_number', observed: 10 }, { applied: 20, observed: 20 }, { applied: 30, observed: 30 }]))
      .field('pass', 'true')
      .field('reasons', '[]')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, 'photo1.jpg')
      .attach('files', fakeJpeg, 'photo2.jpg');

    expect(res.status).toBe(400);

    const appRow = db.prepare('SELECT state FROM applications WHERE id = ?').get(appInvalidId) as { state: string };
    expect(appRow.state).toBe('ACCEPTED');
  });

  it('atomically rolls back if certificate issuance fails: no inspection saved and state remains ACCEPTED', async () => {
    const appFailGateId = 'APP-FAIL-GATE';
    const biz = db.prepare('SELECT id FROM businesses LIMIT 1').get() as { id: string };
    const inst = db.prepare("SELECT id FROM instruments WHERE business_id = ? AND type_code = 'W-1' LIMIT 1").get(biz.id) as { id: string };

    // Application without payment or receipt (fee gate will fail!)
    db.prepare(`
      INSERT OR REPLACE INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule)
      VALUES (?, ?, ?, 'ACCEPTED', 100, 'LMO')
    `).run(appFailGateId, biz.id, inst.id);

    db.prepare(`
      INSERT OR REPLACE INTO appointments (id, application_id, officer_id, slot_date, slot_time, status)
      VALUES (?, ?, 'USR-LMO1', '2026-10-10', '09:00', 'ARRIVED')
    `).run('APT-FAIL-GATE', appFailGateId);

    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');
    const readings = [
      { applied: 10, observed: 10 },
      { applied: 20, observed: 20 },
      { applied: 50, observed: 50 }
    ];

    const res = await request(app)
      .post(`/api/field/jobs/${appFailGateId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', JSON.stringify([true, true, true]))
      .field('readings', JSON.stringify(readings))
      .field('pass', 'true')
      .field('reasons', '[]')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, 'photo1.jpg')
      .attach('files', fakeJpeg, 'photo2.jpg');

    // Should fail because fee gate is not satisfied
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Fee gate not satisfied/i);

    // CRITICAL: Must be atomic! Application state remains ACCEPTED
    const appRow = db.prepare('SELECT state FROM applications WHERE id = ?').get(appFailGateId) as { state: string };
    expect(appRow.state).toBe('ACCEPTED');

    // CRITICAL: No inspection row saved
    const inspRow = db.prepare('SELECT id FROM inspections WHERE application_id = ?').get(appFailGateId);
    expect(inspRow).toBeUndefined();
  });

  it('submits inspection with shared storageDir and newly issued certificate verifies as VALID with integrity: true', async () => {
    const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60]);
    const hash = crypto.createHash('sha256').update(fakeJpeg).digest('hex');
    const readings = [
      { applied: 10, observed: 10 },
      { applied: 20, observed: 20 },
      { applied: 50, observed: 50 }
    ];

    const res = await request(app)
      .post(`/api/field/jobs/${testAppId}/inspection`)
      .set('Cookie', [`token=${lmoToken}`])
      .set('x-csrf-token', 'dummy')
      .field('checklist', JSON.stringify([true, true, true]))
      .field('readings', JSON.stringify(readings))
      .field('pass', 'true')
      .field('reasons', '[]')
      .field('clientHashes', JSON.stringify([hash, hash]))
      .field('clientCaptureTimes', JSON.stringify([new Date().toISOString(), new Date().toISOString()]))
      .attach('files', fakeJpeg, 'photo1.jpg')
      .attach('files', fakeJpeg, 'photo2.jpg');

    expect(res.status).toBe(200);
    expect(res.body.certificateId).toBeDefined();
    testPublicId = res.body.certificateId;

    // Direct seal verification helper
    const intact = verifyFullSeal(testPublicId);
    expect(intact).toBe(true);

    // Public verification endpoint
    const verifyRes = await request(app).get(`/api/public/verify/${testPublicId}`);
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.status).toBe('VALID');
    expect(verifyRes.body.integrity).toBe(true);
    expect(verifyRes.body.ticks.sealIntact).toBe(true);
    expect(verifyRes.body.ticks.feeReceipt).toBe(true);
    expect(verifyRes.body.ticks.officerOnSite).toBe(true);
    expect(verifyRes.body.ticks.checklistRecorded).toBe(true);
  });
});
