import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

describe('Block A: Availability and Injection', () => {
  const app = createApp();
  let adminToken: string;

  beforeAll(async () => {
    runMigrations();
    seedDemoData();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nishchay.example', password: 'demo123' });
    
    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find(c => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    adminToken = tokenCookie!.split(';')[0].replace('token=', '');
  });

  it('A1: Invalid sort parameter does not crash the server and returns 400', async () => {
    const res = await request(app)
      .get('/api/certificates/search?sort=zzz_not_a_column')
      .set('Cookie', [`token=${adminToken}`]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBeDefined();

    // Verify server process is still healthy and responsive
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
  });

  it('A2: Arbitrary SQL injection in search sort parameter returns 400', async () => {
    const res = await request(app)
      .get('/api/certificates/search?sort=valid_to+(SELECT+1)')
      .set('Cookie', [`token=${adminToken}`]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBeDefined();
  });

  it('A2: Arbitrary SQL injection in CSV export sort parameter returns 400', async () => {
    const res = await request(app)
      .get('/api/certificates/export?sort=valid_to+(SELECT+1)')
      .set('Cookie', [`token=${adminToken}`]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBeDefined();
  });
});
