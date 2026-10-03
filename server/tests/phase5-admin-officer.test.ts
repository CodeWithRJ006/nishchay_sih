import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';
import { clock } from '../../shared/src/clock.js';
import { DEMO_CERT_VALID } from '../../shared/src/ids.js';
import type { Express } from 'express';

describe('Phase 5: LMO, GATC and Admin Roles End-to-End', () => {
  let app: Express;
  let lmoToken: string;
  let gatcToken: string;
  let adminToken: string;
  let bizToken: string;

  beforeAll(async () => {
    runMigrations();
    clock.setMock(Date.now());
    seedDemoData();
    app = createApp();

    const lmoLogin = await request(app).post('/api/auth/login').send({
      email: 'lmo1@nishchay.example',
      password: 'demo123',
    });
    lmoToken = lmoLogin.headers['set-cookie']![0];

    const gatcLogin = await request(app).post('/api/auth/login').send({
      email: 'gatc1@nishchay.example',
      password: 'demo123',
    });
    gatcToken = gatcLogin.headers['set-cookie']![0];

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@nishchay.example',
      password: 'demo123',
    });
    adminToken = adminLogin.headers['set-cookie']![0];

    const bizLogin = await request(app).post('/api/auth/login').send({
      email: 'biz1@nishchay.example',
      password: 'demo123',
    });
    bizToken = bizLogin.headers['set-cookie']![0];
  });

  describe('1. GET /api/dashboard/officer (LMO & GATC Dashboard)', () => {
    it('enforces RBAC: denies unauthenticated and business users', async () => {
      const unauth = await request(app).get('/api/dashboard/officer');
      expect(unauth.status).toBe(403);

      const asBiz = await request(app).get('/api/dashboard/officer').set('Cookie', bizToken);
      expect(asBiz.status).toBe(403);
    });

    it('LMO dashboard numbers equal direct database counts and include zone & officer details', async () => {
      const res = await request(app).get('/api/dashboard/officer').set('Cookie', lmoToken);
      expect(res.status).toBe(200);

      expect(res.body.name).toBe('Rajesh Sharma');
      expect(res.body.role).toBe('LMO');
      expect(res.body.roleLabel).toBe('Legal Metrology Officer');
      expect(res.body.zoneName).toBe('Hyderabad North');
      expect(res.body.centreName).toBeNull();

      // Database counts for USR-LMO1
      const now = clock.now();
      const todayStr = new Date(now).toISOString().split('T')[0];

      const expectedAwaiting = (db.prepare(`
        SELECT COUNT(*) as c FROM appointments ap
        JOIN applications a ON ap.application_id = a.id
        JOIN instruments i ON a.instrument_id = i.id
        WHERE ap.officer_id = 'USR-LMO1' AND a.state = 'SCHEDULED' AND i.type_code != 'NAWI-3'
      `).get() as { c: number }).c;

      const expectedAccepted = (db.prepare(`
        SELECT COUNT(*) as c FROM appointments ap
        JOIN applications a ON ap.application_id = a.id
        JOIN instruments i ON a.instrument_id = i.id
        WHERE ap.officer_id = 'USR-LMO1' AND a.state = 'ACCEPTED' AND i.type_code != 'NAWI-3'
      `).get() as { c: number }).c;

      const expectedTodayVisits = (db.prepare(`
        SELECT COUNT(*) as c FROM appointments ap
        JOIN applications a ON ap.application_id = a.id
        WHERE ap.officer_id = 'USR-LMO1' AND ap.slot_date = ? AND a.state IN ('SCHEDULED', 'ACCEPTED')
      `).get(todayStr) as { c: number }).c;

      expect(res.body.kpis.awaitingResponse).toBe(expectedAwaiting);
      expect(res.body.kpis.accepted).toBe(expectedAccepted);
      expect(res.body.kpis.todayVisits).toBe(expectedTodayVisits);
      expect(res.body.kpis.capacityToday.limit).toBe(12);
      expect(res.body.kpis.capacityToday.used).toBe(1);

      // Today's schedule includes today's appointment
      expect(res.body.todaySchedule.length).toBeGreaterThanOrEqual(1);
      expect(res.body.todaySchedule[0].slot_date).toBe(todayStr);
    });

    it('GATC dashboard sees only GATC classes (NAWI-3) and includes centre name', async () => {
      const res = await request(app).get('/api/dashboard/officer').set('Cookie', gatcToken);
      expect(res.status).toBe(200);

      expect(res.body.name).toBe('Vikram Malhotra');
      expect(res.body.role).toBe('GATC');
      expect(res.body.roleLabel).toBe('Government Approved Test Centre');
      expect(res.body.centreName).toBe('Deccan Legal Metrology Testing Centre');

      // GATC should not see standard weights/length measures
      for (const job of res.body.needsResponse) {
        expect(job.instrument_class).toBe('NAWI-3');
      }
    });

    it('Officer Profile API returns read-only definition fields, zone name, and load counts', async () => {
      const res = await request(app).get('/api/officer/profile').set('Cookie', lmoToken);
      expect(res.status).toBe(200);

      expect(res.body.name).toBe('Rajesh Sharma');
      expect(res.body.zone_name).toBe('Hyderabad North');
      expect(res.body.daily_capacity).toBe(12);
      expect(typeof res.body.today_load).toBe('number');
      expect(typeof res.body.total_assigned).toBe('number');
      expect(typeof res.body.total_completed).toBe('number');
    });
  });

  describe('2. Officer Accept and Reject Workflow', () => {
    it('officer can accept their assigned appointment', async () => {
      const dash = await request(app).get('/api/dashboard/officer').set('Cookie', lmoToken);
      const pendingJob = dash.body.needsResponse[0];
      expect(pendingJob).toBeDefined();

      const acceptRes = await request(app)
        .post('/api/appointments/accept')
        .set('Cookie', lmoToken)
        .set('x-csrf-token', 'dummy')
        .send({ applicationId: pendingJob.id });

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.success).toBe(true);

      const check = db.prepare('SELECT state FROM applications WHERE id = ?').get(pendingJob.id) as { state: string };
      expect(check.state).toBe('ACCEPTED');

      const apptCheck = db.prepare('SELECT status FROM appointments WHERE application_id = ?').get(pendingJob.id) as { status: string };
      expect(apptCheck.status).toBe('ACCEPTED');
    });

    it('officer can reject an appointment with a reason', async () => {
      // First, create a new scheduled appointment for USR-LMO1 to reject
      const appId = 'NSH-A-2026-999991';
      db.prepare("INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, 'BIZ-1', 'NSH-I-000001', 'SCHEDULED', 100, 'Routed to LMO')")
        .run(appId);
      db.prepare("INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES ('APT-TEST-REJ', ?, 'USR-LMO1', '2026-10-15', 'MORNING', 'SCHEDULED')")
        .run(appId);

      const rejectRes = await request(app)
        .post('/api/appointments/reject')
        .set('Cookie', lmoToken)
        .set('x-csrf-token', 'dummy')
        .send({ applicationId: appId, reason: 'Calibration standards unavailable on specified date' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);

      // Rejection record saved
      const rejRecord = db.prepare('SELECT * FROM officer_rejections WHERE application_id = ?').get(appId) as { reason: string; officer_id: string };
      expect(rejRecord).toBeDefined();
      expect(rejRecord.reason).toBe('Calibration standards unavailable on specified date');
      expect(rejRecord.officer_id).toBe('USR-LMO1');
    });
  });

  describe('3. GET /api/dashboard/admin (Admin Dashboard & Telemetry)', () => {
    it('enforces RBAC: only ADMIN can access admin dashboard', async () => {
      const unauth = await request(app).get('/api/dashboard/admin');
      expect(unauth.status).toBe(403);

      const asBiz = await request(app).get('/api/dashboard/admin').set('Cookie', bizToken);
      expect(asBiz.status).toBe(403);

      const asLmo = await request(app).get('/api/dashboard/admin').set('Cookie', lmoToken);
      expect(asLmo.status).toBe(403);
    });

    it('admin dashboard numbers equal direct database counts', async () => {
      const res = await request(app).get('/api/dashboard/admin').set('Cookie', adminToken);
      expect(res.status).toBe(200);

      const totalApps = (db.prepare('SELECT COUNT(*) as c FROM applications').get() as { c: number }).c;
      const validCerts = (db.prepare("SELECT COUNT(*) as c FROM certificates WHERE status = 'VALID' AND datetime(valid_to) > datetime('now')").get() as { c: number }).c;
      const fees = (db.prepare("SELECT IFNULL(SUM(amount), 0) as total FROM payments WHERE status = 'PAID'").get() as { total: number }).total;
      const complaints = (db.prepare('SELECT COUNT(*) as c FROM certificate_complaints').get() as { c: number }).c;
      const gateBlocks = (db.prepare("SELECT COUNT(*) as c FROM audit_log WHERE action = 'GATE_BLOCKED'").get() as { c: number }).c;

      expect(res.body.kpis.applications).toBe(totalApps);
      expect(res.body.kpis.validCertificates).toBe(validCerts);
      expect(res.body.kpis.feesCollected).toBe(fees);
      expect(res.body.kpis.openComplaints).toBe(complaints);
      expect(res.body.kpis.gateBlocks).toBe(gateBlocks);
    });

    it('applications by state sum to total applications and contain percentages', async () => {
      const res = await request(app).get('/api/dashboard/admin').set('Cookie', adminToken);
      const totalInBreakdown = res.body.applicationsByState.reduce((acc: number, item: { count: number }) => acc + item.count, 0);
      expect(totalInBreakdown).toBe(res.body.kpis.applications);
      expect(res.body.applicationsByState.length).toBeGreaterThan(0);
    });

    it('complaints telemetry aggregates complaints per merchant', async () => {
      const res = await request(app).get('/api/dashboard/admin').set('Cookie', adminToken);
      expect(res.body.complaints.byBusiness).toBeDefined();
      expect(Array.isArray(res.body.complaints.byBusiness)).toBe(true);
      expect(res.body.complaints.byBusiness.length).toBeGreaterThan(0);
    });

    it('live activity feed contains readable sentences without personal data', async () => {
      const res = await request(app).get('/api/admin/activity-feed').set('Cookie', adminToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      for (const item of res.body) {
        expect(typeof item.message).toBe('string');
        // Ensure no phone numbers or emails in readable sentences
        expect(item.message).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        expect(item.message).not.toMatch(/\+91\d{10}/);
      }
    });
  });

  describe('4. Admin Queue, Revocation & Provisioning', () => {
    it('admin can assign an unassigned job from the queue', async () => {
      // Create an unassigned job in PAID state
      const appId = 'NSH-A-2026-999992';
      db.prepare("INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, 'BIZ-2', 'NSH-I-000004', 'PAID', 150, 'Routed to LMO')")
        .run(appId);
      db.prepare("INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES ('APT-UNASSIGNED', ?, NULL, '2026-10-18', 'MORNING', 'SCHEDULED')")
        .run(appId);

      const assignRes = await request(app)
        .post('/api/admin/assign')
        .set('Cookie', adminToken)
        .set('x-csrf-token', 'dummy')
        .send({
          applicationId: appId,
          officerId: 'USR-LMO2',
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.success).toBe(true);

      // Verify application transitioned to SCHEDULED and officer assigned
      const checkApp = db.prepare('SELECT state FROM applications WHERE id = ?').get(appId) as { state: string };
      expect(checkApp.state).toBe('SCHEDULED');

      const checkAppt = db.prepare('SELECT officer_id FROM appointments WHERE application_id = ?').get(appId) as { officer_id: string };
      expect(checkAppt.officer_id).toBe('USR-LMO2');
    });

    it('admin revoke certificate changes public page status to REVOKED and sets revokedAt without exposing reason', async () => {
      const publicId = DEMO_CERT_VALID;

      // Verify currently VALID
      const before = await request(app).get(`/api/public/verify/${publicId}`);
      expect(before.body.status).toBe('VALID');
      expect(before.body.revokedAt).toBeNull();

      // Revoke as admin
      const revokeRes = await request(app)
        .post(`/api/certificates/${publicId}/revoke`)
        .set('Cookie', adminToken)
        .set('x-csrf-token', 'dummy')
        .send({ reason: 'Lead verification seal compromised during market inspection' });

      expect(revokeRes.status).toBe(200);

      // Verify public page now reports REVOKED
      const after = await request(app).get(`/api/public/verify/${publicId}`);
      expect(after.body.status).toBe('REVOKED');
      expect(typeof after.body.revokedAt).toBe('string');
      expect(after.body.revokedAt).not.toBeNull();

      // Crucial: revoked reason is never exposed publicly
      expect(after.body).not.toHaveProperty('revoked_reason');
      expect(after.body).not.toHaveProperty('reason');
    });

    it('provisioning creates a working login with demo default password', async () => {
      const uniqueEmail = `new_officer_${Date.now()}@nishchay.example`;

      const provisionRes = await request(app)
        .post('/api/admin/provision')
        .set('Cookie', adminToken)
        .set('x-csrf-token', 'dummy')
        .send({
          email: uniqueEmail,
          name: 'Anand Varma',
          role: 'LMO',
          zone_id: 'Z-HYD-01',
          daily_capacity: 8,
        });

      expect(provisionRes.status).toBe(200);
      expect(provisionRes.body.defaultPassword).toBe('demo123');
      expect(provisionRes.body.email).toBe(uniqueEmail);

      // Verify working login with provisioned account
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: uniqueEmail,
          password: 'demo123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.role).toBe('LMO');
      expect(loginRes.body.name).toBe('Anand Varma');
      expect(loginRes.headers['set-cookie']).toBeDefined();
    });
  });
});
