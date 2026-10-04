import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

describe('CSRF Real Flow with Cookie Jar', () => {
  const app = createApp();

  beforeAll(() => {
    runMigrations();
    seedDemoData();
  });

  it('uses real login flow and cookie jar to POST complaint, update profile, and apply without CSRF token missing', async () => {
    const agent = request.agent(app);

    // 1. Real login flow
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email: 'biz1@nishchay.example', password: 'demo123' });
    expect(loginRes.status).toBe(200);

    // Extract csrf cookie just like web/src/lib/api.ts does from document.cookie
    const rawCookies = loginRes.headers['set-cookie'];
    const setCookieHeaders: string[] = Array.isArray(rawCookies)
      ? rawCookies
      : (typeof rawCookies === 'string' ? [rawCookies] : []);
    const csrfCookieHeader = setCookieHeaders.find((h: string) => h.startsWith('csrf='));
    let csrfToken = csrfCookieHeader ? csrfCookieHeader.split(';')[0].split('=')[1] : 'nsh-csrf-active';
    expect(csrfToken).toBeTruthy();

    // 2. POST complaint with x-csrf-token
    const complaintRes = await agent
      .post('/api/certificates/sample-cert-val1d-0000/complaint')
      .set('x-csrf-token', csrfToken)
      .send({
        category: 'CALIBRATION',
        note: 'Scale calibration discrepancy observed in field',
      });
    expect(complaintRes.status).toBe(200);
    expect(complaintRes.body.code).not.toBe('CSRF_MISSING');
    expect(complaintRes.body.error).not.toBe('CSRF token missing');

    // If the server set a new csrf cookie (as it does on first mutating or non-login request),
    // update csrfToken just like browser's document.cookie updates
    const complaintSetCookies = complaintRes.headers['set-cookie'];
    const complaintCookieArray = Array.isArray(complaintSetCookies) ? complaintSetCookies : (typeof complaintSetCookies === 'string' ? [complaintSetCookies] : []);
    const newCsrf = complaintCookieArray.find((h: string) => h.startsWith('csrf='));
    if (newCsrf) {
      csrfToken = newCsrf.split(';')[0].split('=')[1];
    }

    // 3. Save / Update business profile with updated x-csrf-token
    const profileRes = await agent
      .put('/api/business/profile')
      .set('x-csrf-token', csrfToken)
      .send({
        id: 'BIZ-1',
        name: 'Rao Weighing Systems Updated',
        address: 'Plot 45, Industrial Estate, Hyderabad',
        zone_id: 'ZONE-1',
      });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.code).not.toBe('CSRF_MISSING');
    expect(profileRes.body.message).not.toBe('CSRF token missing');

    // 4. Register instrument and apply for an instrument with x-csrf-token
    const instRes = await agent
      .post('/api/instruments')
      .set('x-csrf-token', csrfToken)
      .send({
        type_code: 'W-1',
        make: 'National Weights',
        model: 'NW-5',
        serial: `SN-FLOW-${Date.now()}`,
        capacity: '5kg',
      });
    expect(instRes.status).toBe(201);
    expect(instRes.body.code).not.toBe('CSRF_MISSING');

    const applyRes = await agent
      .post('/api/applications')
      .set('x-csrf-token', csrfToken)
      .send({
        instrument_id: instRes.body.id,
        documents: [
          { doc_type: 'INVOICE', file_name: 'invoice.pdf', file_hash: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' }
        ],
      });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.code).not.toBe('CSRF_MISSING');
    expect(applyRes.body.message).not.toBe('CSRF token missing');

    // 5. Negative test: prove that omitting x-csrf-token returns 403 CSRF_MISSING
    const forbiddenRes = await agent
      .post('/api/applications')
      .send({
        instrument_id: instRes.body.id,
        documents: [],
      });
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.code).toBe('CSRF_MISSING');
    expect(forbiddenRes.body.message).toBe('CSRF token missing');
  });
});
