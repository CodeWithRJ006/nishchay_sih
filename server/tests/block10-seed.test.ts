import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { seedDemoData } from '../scripts/seed.js';
import { DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED } from '../../shared/src/ids.js';
import { runMigrations } from '../db/migrate.js';
import { verifyFullSeal } from '../seal/verifyFull.js';
import { clock } from '../../shared/src/clock.js';
import type { Express } from 'express';

describe('Seed Dates & Properties', () => {
  let app: Express;

  beforeAll(async () => {
    runMigrations();
    clock.setMock(Date.now()); // Default clock
    seedDemoData();
    app = createApp();
  });

  it('three samples verify as VALID, EXPIRED and REVOKED', async () => {
    const valid = await request(app).get(`/api/certificates/${DEMO_CERT_VALID}`);
    expect(valid.body.status).toBe('VALID');

    const expired = await request(app).get(`/api/certificates/${DEMO_CERT_EXPIRED}`);
    expect(expired.body.status).toBe('EXPIRED');

    const revoked = await request(app).get(`/api/certificates/${DEMO_CERT_REVOKED}`);
    expect(revoked.body.status).toBe('REVOKED');
  });

  it('each public API response has non-empty business name, instrument type and serial', async () => {
    for (const id of [DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED]) {
      const res = await request(app).get(`/api/certificates/${id}`);
      const record = JSON.parse(res.body.public_record);
      expect(record.tradeName).toBeTruthy();
      expect(record.instrumentClass).toBeTruthy();
      expect(record.serialNo).toBeTruthy();
    }
  });

  it('verifyFullSeal is true for all three', async () => {
    for (const id of [DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED]) {
      const isSealValid = verifyFullSeal(id);
      expect(isSealValid).toBe(true);
    }
  });

  it('seeding twice keeps the same ids', async () => {
    const numUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number};
    seedDemoData();
    const numUsers2 = db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number};
    expect(numUsers.c).toBe(numUsers2.c);
  });

  it('every seeded LMO and GATC has configured daily_capacity (GATC has 8)', async () => {
    const officers = db.prepare("SELECT daily_capacity FROM users WHERE role IN ('LMO', 'GATC')").all() as { daily_capacity: number }[];
    for (const o of officers) {
      expect(o.daily_capacity).toBeGreaterThanOrEqual(8);
    }
    const gatc = db.prepare("SELECT daily_capacity, gatc_centre_name FROM users WHERE role = 'GATC'").get() as { daily_capacity: number; gatc_centre_name: string };
    expect(gatc.daily_capacity).toBe(8);
    expect(gatc.gatc_centre_name).toBeTruthy();
  });

  it('POST complaint to the VALID sample with { note: "test" } returns 200 and with { honeypot: "x" } returns 400', async () => {
    const res200 = await request(app).post(`/api/certificates/${DEMO_CERT_VALID}/complaint`).set('x-csrf-token', 'test').send({ note: "test" });
    expect(res200.status).toBe(200);

    const res400 = await request(app).post(`/api/certificates/${DEMO_CERT_VALID}/complaint`).set('x-csrf-token', 'test').send({ honeypot: "x" });
    expect(res400.status).toBe(400);
  });
});
