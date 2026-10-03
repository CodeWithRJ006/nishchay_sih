import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 1a CSRF and API Client Tests', () => {
  const app = createApp();

  beforeAll(() => {
    runMigrations();
    seedDemoData();
  });

  it('server returns 403 with clear message when CSRF header is missing on mutating request', async () => {
    // Log in as business to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'biz1@nishchay.example', password: 'demo123' });

    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers['set-cookie'];

    // Send POST without x-csrf-token header
    const postRes = await request(app)
      .post('/api/instruments')
      .set('Cookie', cookie)
      .send({
        type_code: 'NAWI-3',
        make: 'Test',
        model: 'M1',
        serial: `SN-TEST-${Date.now()}`,
        capacity: '100kg'
      });

    expect(postRes.status).toBe(403);
    expect(postRes.body).toHaveProperty('message');
    expect(postRes.body.message.toLowerCase()).toContain('csrf');
  });

  it('GET requests succeed without CSRF header', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'biz1@nishchay.example', password: 'demo123' });

    const cookie = loginRes.headers['set-cookie'];

    const getRes = await request(app)
      .get('/api/instruments')
      .set('Cookie', cookie);

    expect(getRes.status).toBe(200);
  });

  it('api client source code verifies x-csrf-token is sent on POST, PUT, PATCH, DELETE and not on GET', () => {
    const apiCode = fs.readFileSync('web/src/lib/api.ts', 'utf-8');

    // GET function should not include x-csrf-token
    const getFnMatch = apiCode.match(/export function get<T>[\s\S]*?return fetch\([\s\S]*?\);/);
    expect(getFnMatch).toBeDefined();
    expect(getFnMatch![0]).not.toContain("'x-csrf-token'");

    // POST, PUT, PATCH, DELETE, UPLOAD should include x-csrf-token
    expect(apiCode).toMatch(/export function post[\s\S]*?'x-csrf-token'/);
    expect(apiCode).toMatch(/export function put[\s\S]*?'x-csrf-token'/);
    expect(apiCode).toMatch(/export function patch[\s\S]*?'x-csrf-token'/);
    expect(apiCode).toMatch(/export function del[\s\S]*?'x-csrf-token'/);
    expect(apiCode).toMatch(/export function upload[\s\S]*?'x-csrf-token'/);
  });

  it('source-scan test fails if fetch( appears outside lib/api.ts or alert( appears anywhere in web/src', () => {
    function walkDir(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walkDir(fullPath, fileList);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const files = walkDir('web/src');
    const fetchViolations: string[] = [];
    const alertViolations: string[] = [];

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      const normalizedPath = f.replace(/\\/g, '/');

      // Check alert(
      if (/\balert\s*\(/.test(content)) {
        alertViolations.push(f);
      }

      // Check fetch( outside web/src/lib/api.ts
      if (normalizedPath !== 'web/src/lib/api.ts') {
        if (/\bfetch\s*\(/.test(content)) {
          fetchViolations.push(f);
        }
      }
    }

    expect(alertViolations).toEqual([]);
    expect(fetchViolations).toEqual([]);
  });
});
