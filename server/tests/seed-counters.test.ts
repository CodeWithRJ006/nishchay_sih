import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData, DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED } from '../scripts/seed.js';

const app = createApp();

describe('Seed counters and idempotency', () => {
  beforeAll(() => {
    runMigrations();
  });

  it('seedDemoData runs successfully on a fresh database', () => {
    seedDemoData();
  });

  it('seedDemoData runs twice without throwing and preserves sample certificates', () => {
    seedDemoData();
    const count = db.prepare(`SELECT COUNT(*) as c FROM certificates WHERE public_id IN (?, ?, ?)`).get(DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED) as { c: number };
    expect(count.c).toBe(3);
  });

  it('instrument counter is synced properly', () => {
    const instruments = db.prepare('SELECT id FROM instruments').all() as { id: string }[];
    const maxSeeded = Math.max(0, ...instruments.map(i => parseInt(i.id.split('-').pop() || '0', 10)));
    const counter = (db.prepare('SELECT val FROM counters WHERE id = ?').get('instrument') as { val: number })?.val || 0;
    expect(counter).toBeGreaterThanOrEqual(maxSeeded);
  });

  it('can register 10 instruments through the API without constraint errors', async () => {
    // We need to login as BUSINESS to register instruments
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'biz1@nishchay.example', password: 'demo123' })
      .expect(200);
    const cookie = (loginRes.headers['set-cookie'] as unknown as string[]) || [];
    
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/instruments')
        .set('Cookie', cookie)
        .set('x-csrf-token', 'test')
        .send({
          type_code: 'NAWI-3',
          make: 'TestMake',
          model: 'TestModel',
          capacity: '100kg',
          serial: 'SN-TEST-' + i
        });
      
      expect(res.status).toBe(201);
      
      expect(res.body).toHaveProperty('id');
      ids.add(res.body.id);
    }
    
    // All 10 IDs should be unique
    expect(ids.size).toBe(10);
  });
});
