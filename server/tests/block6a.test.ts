import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';

describe('Block 6a: Field Arrival', () => {
  const app = createApp();
  let lmoToken: string;
  let gatcToken: string;
  
  beforeAll(async () => {
    const { runMigrations } = await import('../db/migrate.js');
    const { seedDemoData } = await import('../scripts/seed.js');
    runMigrations();
    seedDemoData();
    
    // Login as LMO
    let res = await request(app).post('/api/auth/login').send({ email: 'lmo1@nishchay.gov.in', password: 'demo123' });
    lmoToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];

    res = await request(app).post('/api/auth/login').send({ email: 'gatc1@nishchay.gov.in', password: 'demo123' });
    gatcToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
  });

  it('LMO can see assigned jobs with coordinates', async () => {
    // Wait, by default seed doesn't schedule jobs for lmo1.
    // Let's create one.
    db.prepare("INSERT INTO applications (id, business_id, instrument_id, state) VALUES ('APP-6A', 'BIZ-1', 'NSH-I-000001', 'ACCEPTED')").run();
    db.prepare("INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES ('APT-6A', 'APP-6A', 'USR-LMO1', '2025-01-01', 'Morning', 'ACCEPTED')").run();
    
    const res = await request(app).get('/api/appointments/my-jobs').set('Cookie', `token=${lmoToken}`);
    expect(res.status).toBe(200);
    const job = res.body.find((j: { application_id: string; lat: number; lng: number }) => j.application_id === 'APP-6A');
    expect(job).toBeDefined();
    expect(job.lat).toBeDefined();
    expect(job.lng).toBeDefined();
  });

  it('Cannot arrive at unassigned job', async () => {
    const res = await request(app).post('/api/field/jobs/APP-6A/arrive').set('Cookie', `token=${gatcToken}`).set('x-csrf-token', 'dummy');
    // IsAssignedOfficer middleware rejects it
    expect(res.status).toBe(403);
  });

  it('Can arrive at assigned job and changes status to ARRIVED', async () => {
    const res = await request(app).post('/api/field/jobs/APP-6A/arrive').set('Cookie', `token=${lmoToken}`).set('x-csrf-token', 'dummy');
    expect(res.status).toBe(200);

    const apt = db.prepare("SELECT status FROM appointments WHERE application_id = 'APP-6A'").get() as { status: string };
    expect(apt.status).toBe('ARRIVED');
    
    const audit = db.prepare("SELECT * FROM audit_log WHERE record_id = 'APP-6A' AND action = 'ARRIVED'").get();
    expect(audit).toBeDefined();
  });
});
