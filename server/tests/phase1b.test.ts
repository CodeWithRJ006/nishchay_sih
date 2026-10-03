import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import { nextSeq } from '../../web/src/lib/demo.js';
import fs from 'node:fs';

describe('Phase 1b Tests', () => {
  const app = createApp();

  beforeAll(() => {
    runMigrations();
    seedDemoData();
  });

  it('GET /api/zones returns zone list with id, name, and code', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nishchay.example', password: 'demo123' });

    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/zones')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('code');
  });

  it('provisioning with a zone select works', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nishchay.example', password: 'demo123' });

    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers['set-cookie'];
    const csrfToken = 'test-csrf';

    const n = nextSeq();
    const newOfficer = {
      name: `Officer Z${n}`,
      email: `officer_z${n}_${Date.now()}@nishchay.example`,
      role: 'LMO',
      zone_id: 'ZONE-1',
      daily_capacity: 5
    };

    const provRes = await request(app)
      .post('/api/admin/provision')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken)
      .send(newOfficer);

    expect([200, 201]).toContain(provRes.status);
  });

  it('demo fill produces unique values twice in a row so repeats never collide', () => {
    const n1 = nextSeq();
    const email1 = `officer_${n1}_${Date.now()}@nishchay.example`;
    const serial1 = `SN-${n1}-${Date.now()}`;

    const n2 = nextSeq();
    const email2 = `officer_${n2}_${Date.now()}@nishchay.example`;
    const serial2 = `SN-${n2}-${Date.now()}`;

    expect(n1).not.toBe(n2);
    expect(email1).not.toBe(email2);
    expect(serial1).not.toBe(serial2);
  });

  it('toast module exports variants and uses role="alert" for error', () => {
    const toastSource = fs.readFileSync('web/src/components/ui/Toast.tsx', 'utf-8');
    expect(toastSource).toContain("role: 'alert'");
    expect(toastSource).toContain('bg-seal-break-red');
    expect(toastSource).toContain('bg-verified-green');
    expect(toastSource).toContain('bg-calibration-blue');
    expect(toastSource).toContain('duration = 6000');
  });

  it('every form input has an id and an explicit autoComplete attribute', () => {
    const forms = [
      'web/src/pages/Login.tsx',
      'web/src/pages/Register.tsx',
      'web/src/pages/AdminProvision.tsx',
      'web/src/pages/BusinessProfile.tsx',
      'web/src/pages/Instruments.tsx',
      'web/src/pages/ApplicationWizard.tsx',
    ];

    for (const formFile of forms) {
      const code = fs.readFileSync(formFile, 'utf-8');
      
      // Match all <Input ... /> or <input ... /> across multiple lines
      const inputTags = code.match(/<(Input|input)[\s\S]*?\/>/g) || [];
      expect(inputTags.length).toBeGreaterThan(0);

      const seenIds = new Set<string>();

      for (const tag of inputTags) {
        expect(tag).toMatch(/id=/);
        expect(tag).toMatch(/autoComplete=/);

        const idMatch = tag.match(/id=["']([^"']+)["']/);
        if (idMatch) {
          const id = idMatch[1];
          expect(seenIds.has(id)).toBe(false);
          seenIds.add(id);
        }
      }
    }
  });
});
