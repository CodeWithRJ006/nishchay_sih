import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import { resetLockouts } from '../auth/index.js';

describe('Block B: Authentication, Access Control, and Exposure', () => {
  let app: ReturnType<typeof createApp>;
  let bizToken: string;
  let adminToken: string;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    runMigrations();
    seedDemoData();
    app = createApp();

    const bizLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'biz1@nishchay.example', password: 'demo123' });
    const bizCookies = bizLogin.headers['set-cookie'] as unknown as string[];
    bizToken = bizCookies.find(c => c.startsWith('token='))!.split(';')[0].replace('token=', '');

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nishchay.example', password: 'demo123' });
    const adminCookies = adminLogin.headers['set-cookie'] as unknown as string[];
    adminToken = adminCookies.find(c => c.startsWith('token='))!.split(';')[0].replace('token=', '');
  });

  beforeEach(() => {
    resetLockouts();
  });

  it('B1: BUSINESS gets 403 on demo admin endpoints', async () => {
    const resReset = await request(app)
      .post('/api/admin/demo/reset')
      .set('Cookie', [`token=${bizToken}`, `csrf=testcsrf`])
      .set('x-csrf-token', 'testcsrf');
    expect(resReset.status).toBe(403);

    const resIssue = await request(app)
      .post('/api/admin/demo/issue-no-payment')
      .set('Cookie', [`token=${bizToken}`, `csrf=testcsrf`])
      .set('x-csrf-token', 'testcsrf');
    expect(resIssue.status).toBe(403);

    const resTamper = await request(app)
      .post('/api/admin/demo/tamper')
      .set('Cookie', [`token=${bizToken}`, `csrf=testcsrf`])
      .set('x-csrf-token', 'testcsrf');
    expect(resTamper.status).toBe(403);

    const resUndo = await request(app)
      .post('/api/admin/demo/undo-tamper')
      .set('Cookie', [`token=${bizToken}`, `csrf=testcsrf`])
      .set('x-csrf-token', 'testcsrf');
    expect(resUndo.status).toBe(403);

    const resStatus = await request(app)
      .get('/api/admin/demo/tamper-status')
      .set('Cookie', [`token=${bizToken}`]);
    expect(resStatus.status).toBe(403);
  });

  it('B1: With DEMO_MODE=false demo endpoints return 404', async () => {
    const prev = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'false';
    try {
      const resTamper = await request(app)
        .post('/api/admin/demo/tamper')
        .set('Cookie', [`token=${adminToken}`])
        .send({ publicId: 'sample-cert-val1d-0000' });
      expect(resTamper.status).toBe(404);

      const resLoginAs = await request(app)
        .post('/api/demo/login-as/ADMIN')
        .send();
      expect(resLoginAs.status).toBe(404);
    } finally {
      process.env.DEMO_MODE = prev;
    }
  });

  it('B1: Tamper on non-sample certificate ID returns 400', async () => {
    const res = await request(app)
      .post('/api/admin/demo/tamper')
      .set('Cookie', [`token=${adminToken}`, 'csrf=admincsrf'])
      .set('x-csrf-token', 'admincsrf')
      .send({ publicId: 'real-issued-cert-1234' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only sample demonstrator certificates');
  });

  it('B4: GET /api/certificates/:publicId exposes only whitelisted fields', async () => {
    const res = await request(app).get('/api/certificates/sample-cert-val1d-0000');
    expect(res.status).toBe(200);

    expect(res.body.publicId).toBe('sample-cert-val1d-0000');
    expect(res.body.tradeName).toBeDefined();
    expect(res.body.instrumentType).toBeDefined();
    expect(res.body.instrumentClass).toBeDefined();
    expect(res.body.serial).toBeDefined();
    expect(res.body.status).toBe('VALID');
    expect(res.body.validFrom).toBeDefined();
    expect(res.body.validTo).toBeDefined();
    expect(res.body.authorityName).toBeDefined();
    expect(res.body.publicRecord).toBeDefined();
    expect(res.body.signature).toBeDefined();
    expect(res.body.keyId).toBeDefined();

    // Must NOT leak internal IDs, photos, officer names
    expect(res.body.application_id).toBeUndefined();
    expect(res.body.receipt_id).toBeUndefined();
    expect(res.body.details_digest).toBeUndefined();
    expect(res.body.officerId).toBeUndefined();
    expect(res.body.officer_id).toBeUndefined();
    expect(res.body.photos).toBeUndefined();
  });

  it('B4: Authenticated user can view /api/certificates/:id/detail', async () => {
    const resAdmin = await request(app)
      .get('/api/certificates/sample-cert-val1d-0000/detail')
      .set('Cookie', [`token=${adminToken}`]);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.certificate).toBeDefined();

    const resPublic = await request(app)
      .get('/api/certificates/sample-cert-val1d-0000/detail');
    expect(resPublic.status).toBe(403);
  });

  it('B5: Account lockout after 5 consecutive failed logins returns generic error', async () => {
    const email = 'lockout_target@nishchay.example';
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    }

    // 6th attempt should also return generic error while locked out
    const lockedRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });
    expect(lockedRes.status).toBe(401);
    expect(lockedRes.body.message).toBe('Invalid email or password');
  });

  it('B6: Registration generates deterministic sequence ID and enforces password length >= 8', async () => {
    const shortPassRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'shortpass@nishchay.example',
        password: 'pass',
        name: 'Short Pass User'
      });
    expect(shortPassRes.status).toBe(400);

    const validReg = await request(app)
      .post('/api/auth/register')
      .send({
        email: `seq_user_${Date.now()}@nishchay.example`,
        password: 'validPassword123',
        name: 'Sequential User',
        address: 'Secunderabad'
      });
    expect(validReg.status).toBe(201);
    expect(validReg.body.id).toMatch(/^USR-\d{4}$/);
    expect(validReg.body.businessId).toMatch(/^BIZ-\d{4}$/);
  });

  it('B7: Helmet CSP drops unsafe-eval and Google fonts', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toBeDefined();
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('fonts.googleapis.com');
  });

  it('B8: CSRF rejects missing or mismatched token on mutating requests', async () => {
    // Missing CSRF token
    const missingRes = await request(app)
      .post('/api/instruments')
      .set('Cookie', [`token=${bizToken}`, 'csrf=expected-token'])
      .send({ type_code: 'W-1', make: 'M', model: 'M', serial: 'S1', capacity: '10kg' });
    expect(missingRes.status).toBe(403);
    expect(missingRes.body.code).toBe('CSRF_MISSING');

    // Mismatched CSRF token
    const mismatchRes = await request(app)
      .post('/api/instruments')
      .set('Cookie', [`token=${bizToken}`, 'csrf=expected-token'])
      .set('x-csrf-token', 'wrong-token')
      .send({ type_code: 'W-1', make: 'M', model: 'M', serial: 'S1', capacity: '10kg' });
    expect(mismatchRes.status).toBe(403);
    expect(mismatchRes.body.code).toBe('CSRF_MISMATCH');
  });
});
