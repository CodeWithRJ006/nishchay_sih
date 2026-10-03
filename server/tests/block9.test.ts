import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';
import { certificateService } from '../services/certificateService.js';
import type { Express } from 'express';

describe('Block 9-14 Tests (Certificates, Search, Export, Public Verify, Seal, Complaints)', () => {
  let app: Express;
  let adminCookie: string;
  let bizCookie: string;
  let publicId: string;
  

  beforeAll(async () => {
    runMigrations();
    seedDemoData();
    app = createApp();

    const resAdmin = await request(app).post('/api/auth/login').send({ email: 'admin@nishchay.example', password: 'demo123' });
    adminCookie = resAdmin.headers['set-cookie']![0];

    const resBiz = await request(app).post('/api/auth/login').send({ email: 'biz1@nishchay.example', password: 'demo123' });
    bizCookie = resBiz.headers['set-cookie']![0];

    const app4Id = 'NSH-A-2025-000004';
    // Insert an inspection for app4 so we can issue a cert
    db.prepare("INSERT OR IGNORE INTO inspections (id, application_id, officer_id, gps_lat, gps_lng, gps_distance, checklist, readings, pass) VALUES ('INSP-block9', ?, 'USR-LMO1', 0, 0, 0, '[]', '[]', 1)").run(app4Id);
    
    publicId = await certificateService.issueCertificate(app4Id, 'USR-LMO1');
  });

  it('GET /api/certificates/:publicId returns certificate and verifies seal', async () => {
    const res = await request(app).get(`/api/certificates/${publicId}`);
    expect(res.status).toBe(200);
    expect(res.body.public_id).toBe(publicId);
    expect(res.body.status).toBe('VALID');
  });

  it('GET /api/certificates/:publicId/pdf returns a PDF document', async () => {
    const res = await request(app).get(`/api/certificates/${publicId}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  it('POST /api/certificates/:publicId/complaint adds a complaint', async () => {
    const res = await request(app).post(`/api/certificates/${publicId}/complaint`).set('x-csrf-token', 'test').send({ note: 'Looks tampered' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const complaints = db.prepare('SELECT * FROM certificate_complaints WHERE public_id = ?').all(publicId);
    expect(complaints.length).toBe(1);
  });

  it('GET /api/certificates/search returns paginated filtered certificates', async () => {
    const res = await request(app).get('/api/certificates/search').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.results).toBeInstanceOf(Array);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    expect(res.body.results[0].public_id).toBe(publicId);
  });

  it('GET /api/certificates/export returns CSV data', async () => {
    const res = await request(app).get('/api/certificates/export').set('Cookie', bizCookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Public ID,Instrument ID,Class,Status,Valid From,Valid To,Business Name');
    expect(res.text).toContain(publicId);
  });

  it('POST /api/certificates/:publicId/revoke revokes the certificate (Admin only)', async () => {
    const resForbidden = await request(app).post(`/api/certificates/${publicId}/revoke`).set('x-csrf-token', 'test').set('Cookie', bizCookie).send({ reason: 'Test' });
    expect(resForbidden.status).toBe(403);

    const res = await request(app).post(`/api/certificates/${publicId}/revoke`).set('x-csrf-token', 'test').set('Cookie', adminCookie).send({ reason: 'Stolen' });
    expect(res.status).toBe(200);
    
    const check = db.prepare('SELECT status, revoked_reason FROM certificates WHERE public_id = ?').get(publicId) as { status: string, revoked_reason: string };
    expect(check.status).toBe('REVOKED');
    expect(check.revoked_reason).toBe('Stolen');
  });
});
