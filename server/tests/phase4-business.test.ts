import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';
import { clock } from '../../shared/src/clock.js';
import type { Express } from 'express';

describe('Phase 4: Realistic Data & Business Role End-to-End', () => {
  let app: Express;
  let bizToken: string;
  let lmoToken: string;
  let adminToken: string;

  beforeAll(async () => {
    runMigrations();
    clock.setMock(Date.now());
    seedDemoData();
    app = createApp();

    const bizLogin = await request(app).post('/api/auth/login').send({
      email: 'biz1@nishchay.example',
      password: 'demo123',
    });
    bizToken = bizLogin.headers['set-cookie']![0];

    const lmoLogin = await request(app).post('/api/auth/login').send({
      email: 'lmo1@nishchay.example',
      password: 'demo123',
    });
    lmoToken = lmoLogin.headers['set-cookie']![0];

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@nishchay.example',
      password: 'demo123',
    });
    adminToken = adminLogin.headers['set-cookie']![0];
  });

  describe('1. Realistic Seed Data Checks', () => {
    it('named zones exist: Hyderabad North & Hyderabad South', () => {
      const z1 = db.prepare("SELECT * FROM zones WHERE code = 'Z-HYD-01'").get() as { name: string };
      const z2 = db.prepare("SELECT * FROM zones WHERE code = 'Z-HYD-02'").get() as { name: string };
      expect(z1.name).toBe('Hyderabad North');
      expect(z2.name).toBe('Hyderabad South');
    });

    it('officers have real names and GATC has centre name with daily capacity 8', () => {
      const lmo1 = db.prepare("SELECT * FROM users WHERE id = 'USR-LMO1'").get() as { name: string; role: string };
      const lmo2 = db.prepare("SELECT * FROM users WHERE id = 'USR-LMO2'").get() as { name: string; role: string };
      const gatc = db.prepare("SELECT * FROM users WHERE id = 'USR-GATC1'").get() as { name: string; role: string; gatc_centre_name: string; daily_capacity: number };

      expect(lmo1.name).toBe('Rajesh Sharma');
      expect(lmo2.name).toBe('Sunita Reddy');
      expect(gatc.name).toBe('Vikram Malhotra');
      expect(gatc.gatc_centre_name).toBe('Deccan Legal Metrology Testing Centre');
      expect(gatc.daily_capacity).toBe(8);
    });

    it('six businesses seeded with instruments covering all 5 classes', () => {
      const businesses = db.prepare('SELECT COUNT(*) as c FROM businesses').get() as { c: number };
      expect(businesses.c).toBeGreaterThanOrEqual(6);

      const classes = db.prepare('SELECT DISTINCT type_code FROM instruments').all() as { type_code: string }[];
      const codeSet = new Set(classes.map(c => c.type_code));
      expect(codeSet.has('W-1')).toBe(true);
      expect(codeSet.has('L-1')).toBe(true);
      expect(codeSet.has('C-1')).toBe(true);
      expect(codeSet.has('CM-1')).toBe(true);
      expect(codeSet.has('NAWI-3')).toBe(true);
    });

    it('applications exist at every state in the state machine', () => {
      const states = db.prepare('SELECT DISTINCT state FROM applications').all() as { state: string }[];
      const stateSet = new Set(states.map(s => s.state));
      expect(stateSet.has('DRAFT')).toBe(true);
      expect(stateSet.has('SUBMITTED')).toBe(true);
      expect(stateSet.has('PAID')).toBe(true);
      expect(stateSet.has('SCHEDULED')).toBe(true);
      expect(stateSet.has('ACCEPTED')).toBe(true);
      expect(stateSet.has('INSPECTED_PASS')).toBe(true);
      expect(stateSet.has('CERTIFIED')).toBe(true);
      expect(stateSet.has('FAILED')).toBe(true);
    });

    it('today appointment exists for USR-LMO1', () => {
      const todayStr = new Date(clock.now()).toISOString().split('T')[0];
      const apt = db.prepare('SELECT * FROM appointments WHERE officer_id = ? AND slot_date = ?').get('USR-LMO1', todayStr);
      expect(apt).toBeDefined();
    });

    it('demo business (BIZ-1) has exactly 1 certified instrument, 1 SCHEDULED app, 1 without app, and 2 receipts', () => {
      const insts = db.prepare('SELECT * FROM instruments WHERE business_id = ?').all('BIZ-1') as Array<{ id: string }>;
      expect(insts.length).toBe(3);

      const certs = db.prepare(`
        SELECT c.* FROM certificates c
        JOIN instruments i ON c.instrument_id = i.id
        WHERE i.business_id = 'BIZ-1' AND c.status = 'VALID'
      `).all() as Array<{ id: number }>;
      expect(certs.length).toBe(1);

      const scheduledApps = db.prepare("SELECT * FROM applications WHERE business_id = 'BIZ-1' AND state = 'SCHEDULED'").all();
      expect(scheduledApps.length).toBe(1);

      const unappliedInsts = db.prepare(`
        SELECT i.* FROM instruments i
        WHERE i.business_id = 'BIZ-1'
          AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.instrument_id = i.id)
      `).all();
      expect(unappliedInsts.length).toBe(1);

      const receipts = db.prepare(`
        SELECT r.* FROM receipts r
        JOIN applications a ON r.application_id = a.id
        WHERE a.business_id = 'BIZ-1'
      `).all();
      expect(receipts.length).toBe(2);
    });
  });

  describe('2. GET /api/dashboard/business API & Role Scoping', () => {
    it('returns 403 for non-business users and unauthenticated requests', async () => {
      const unauth = await request(app).get('/api/dashboard/business');
      expect(unauth.status).toBe(403);

      const asLmo = await request(app).get('/api/dashboard/business').set('Cookie', lmoToken);
      expect(asLmo.status).toBe(403);

      const asAdmin = await request(app).get('/api/dashboard/business').set('Cookie', adminToken);
      expect(asAdmin.status).toBe(403);
    });

    it('dashboard numbers equal direct database counts for the seeded data', async () => {
      const res = await request(app).get('/api/dashboard/business').set('Cookie', bizToken);
      expect(res.status).toBe(200);

      const dbInstCount = (db.prepare("SELECT COUNT(*) as c FROM instruments WHERE business_id = 'BIZ-1'").get() as { c: number }).c;
      const dbCertCount = (db.prepare(`
        SELECT COUNT(*) as c FROM certificates c
        JOIN instruments i ON c.instrument_id = i.id
        WHERE i.business_id = 'BIZ-1' AND c.status = 'VALID' AND datetime(c.valid_to) > datetime('now')
      `).get() as { c: number }).c;
      const dbOpenApps = (db.prepare(`
        SELECT COUNT(*) as c FROM applications
        WHERE business_id = 'BIZ-1' AND state NOT IN ('CERTIFIED', 'FAILED', 'CANCELLED')
      `).get() as { c: number }).c;
      const dbFeesPaid = (db.prepare(`
        SELECT IFNULL(SUM(r.amount), 0) as total FROM receipts r
        JOIN applications a ON r.application_id = a.id
        WHERE a.business_id = 'BIZ-1'
      `).get() as { total: number }).total;

      expect(res.body.tradeName).toBe('Biz One');
      expect(res.body.kpis.totalInstruments).toBe(dbInstCount);
      expect(res.body.kpis.validCertificates).toBe(dbCertCount);
      expect(res.body.kpis.openApplications).toBe(dbOpenApps);
      expect(res.body.kpis.feesPaid).toBe(dbFeesPaid);

      // Verify "Your next step" banner points to the SCHEDULED application
      expect(res.body.nextStep.title).toBe('Inspection scheduled');
      expect(res.body.nextStep.actionLabel).toBe('View appointment');
      expect(res.body.nextStep.actionUrl).toMatch(/\/dashboard\/applications\/NSH-A-/);

      // Verify applicationsInProgress has 1 item
      expect(res.body.applicationsInProgress.length).toBe(1);
      expect(res.body.applicationsInProgress[0].state).toBe('SCHEDULED');

      // Verify instruments table data
      expect(res.body.instruments.length).toBe(3);
      const certified = res.body.instruments.find((i: { status: string }) => i.status === 'CERTIFIED');
      const pending = res.body.instruments.find((i: { status: string }) => i.status === 'PENDING');
      const unverified = res.body.instruments.find((i: { status: string }) => i.status === 'UNVERIFIED');
      expect(certified).toBeDefined();
      expect(pending).toBeDefined();
      expect(unverified).toBeDefined();

      // Verify receipts / payments list has 2 items
      expect(res.body.recentPayments.length).toBe(2);

      // Verify certificates list has 1 item
      expect(res.body.certificates.length).toBe(1);
      expect(res.body.certificates[0].status).toBe('VALID');
    });
  });

  describe('3. Action Endpoints & Wizard with/without Instruments', () => {
    it('supports registering a new instrument and uploading supporting documents', async () => {
      const instRes = await request(app)
        .post('/api/instruments')
        .set('Cookie', bizToken)
        .set('x-csrf-token', 'test')
        .send({
          type_code: 'W-1',
          make: 'Avery Test',
          model: 'AV-100',
          serial: 'TEST-SN-' + Date.now(),
          capacity: '10kg',
          accuracy_class: 'M1',
          location: 'Test Bay',
        });
      expect(instRes.status).toBe(201);
      expect(instRes.body.id).toMatch(/^NSH-I-/);

      // Upload file
      const uploadRes = await request(app)
        .post('/api/upload')
        .set('Cookie', bizToken)
        .set('x-csrf-token', 'test')
        .attach('file', Buffer.from('%PDF-1.4 demo test invoice content'), 'test-invoice.pdf');
      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.fileName).toBeDefined();
      expect(uploadRes.body.fileHash).toBeDefined();

      // Create application
      const appRes = await request(app)
        .post('/api/applications')
        .set('Cookie', bizToken)
        .set('x-csrf-token', 'test')
        .send({
          instrument_id: instRes.body.id,
          documents: [{
            doc_type: 'INVOICE',
            file_name: uploadRes.body.fileName,
            file_hash: uploadRes.body.fileHash,
          }],
        });
      expect(appRes.status).toBe(201);
      expect(appRes.body.id).toMatch(/^NSH-A-/);
    });
  });
});
