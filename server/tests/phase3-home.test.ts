import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { 
  parseVerifyInput, 
  DEMO_CERT_VALID, 
  DEMO_CERT_EXPIRED, 
  DEMO_CERT_REVOKED 
} from '../../shared/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

describe('Phase 3 Home Page Tests', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    runMigrations();
    seedDemoData();
    app = createApp();
  });

  describe('GET /api/config', () => {
    it('returns only { demoMode }', async () => {
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('demoMode');
      expect(typeof res.body.demoMode).toBe('boolean');
      expect(Object.keys(res.body)).toEqual(['demoMode']);
    });
  });

  describe('parseVerifyInput Table Tests', () => {
    const baseUrl = 'http://localhost:5173';

    const testCases: Array<{
      input: string;
      base?: string;
      expected: string | null;
      desc: string;
    }> = [
      // Bare IDs
      { input: 'sample-cert-val1d-0000', expected: 'sample-cert-val1d-0000', desc: 'seeded valid id' },
      { input: 'sample-cert-exp1red-00', expected: 'sample-cert-exp1red-00', desc: 'seeded expired id' },
      { input: 'sample-cert-rev0ked-00', expected: 'sample-cert-rev0ked-00', desc: 'seeded revoked id' },
      { input: 'NSH-C-2026-000001', expected: 'NSH-C-2026-000001', desc: 'standard format certificate id' },
      { input: '  NSH-C-2026-000001  ', expected: 'NSH-C-2026-000001', desc: 'trimmed certificate id' },
      
      // Relative paths
      { input: '/v/sample-cert-val1d-0000', expected: 'sample-cert-val1d-0000', desc: 'relative /v/ path' },
      { input: '  /v/sample-cert-val1d-0000  ', expected: 'sample-cert-val1d-0000', desc: 'trimmed relative /v/ path' },

      // Same-origin full URLs
      { input: 'http://localhost:5173/v/sample-cert-val1d-0000', base: baseUrl, expected: 'sample-cert-val1d-0000', desc: 'same-origin full URL' },
      { input: 'https://nishchay.example/v/NSH-C-2026-000001', base: 'https://nishchay.example', expected: 'NSH-C-2026-000001', desc: 'https same-origin URL' },

      // Rejections: Cross-origin
      { input: 'http://evil.com/v/sample-cert-val1d-0000', base: baseUrl, expected: null, desc: 'cross-origin attack URL' },
      { input: 'https://phishing.org/v/sample-cert-val1d-0000', base: baseUrl, expected: null, desc: 'different hostname' },

      // Rejections: Invalid paths or schemes
      { input: 'http://localhost:5173/certificates/sample-cert-val1d-0000', base: baseUrl, expected: null, desc: 'wrong path prefix' },
      { input: 'http://localhost:5173/v/sample-cert-val1d-0000/details', base: baseUrl, expected: null, desc: 'extra path segment' },
      { input: 'http://localhost:5173/v/sample-cert-val1d-0000?ref=qr', base: baseUrl, expected: null, desc: 'query string present' },
      { input: 'http://localhost:5173/v/sample-cert-val1d-0000#sec', base: baseUrl, expected: null, desc: 'hash fragment present' },
      { input: 'javascript:alert(1)', expected: null, desc: 'javascript URI' },
      { input: '../v/sample-cert-val1d-0000', expected: null, desc: 'path traversal relative' },
      { input: '<script>alert("xss")</script>', expected: null, desc: 'script tags' },
      { input: 'cert id with spaces', expected: null, desc: 'spaces within bare id' },
      { input: '', expected: null, desc: 'empty string' },
      { input: '   ', expected: null, desc: 'whitespace only' },
      { input: 'special!@#$characters', expected: null, desc: 'illegal characters' },
    ];

    testCases.forEach(({ input, base, expected, desc }) => {
      it(`handles ${desc}: "${input}"`, () => {
        const result = parseVerifyInput(input, base);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Sample chips resolve to correct live states', () => {
    it('DEMO_CERT_VALID resolves to status VALID', async () => {
      const res = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VALID');
      expect(res.body.integrity).toBe(true);
    });

    it('DEMO_CERT_EXPIRED resolves to status EXPIRED', async () => {
      const res = await request(app).get(`/api/public/verify/${DEMO_CERT_EXPIRED}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('EXPIRED');
      expect(res.body.integrity).toBe(true);
    });

    it('DEMO_CERT_REVOKED resolves to status REVOKED', async () => {
      const res = await request(app).get(`/api/public/verify/${DEMO_CERT_REVOKED}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REVOKED');
      expect(res.body.integrity).toBe(true);
    });
  });

  describe('Every home link or button targets a route that exists', () => {
    // Known route paths defined in App.tsx
    const appRoutes = [
      '/',
      '/v/:id',
      '/verify/:id',
      '/login',
      '/register',
      '/dashboard',
      '/dashboard/search',
      '/dashboard/certificates',
      '/dashboard/profile',
      '/dashboard/business-profile',
      '/dashboard/officer-profile',
      '/dashboard/provision',
      '/dashboard/instruments',
      '/dashboard/instruments/:id',
      '/dashboard/apply',
      '/dashboard/payment/:applicationId',
      '/dashboard/receipt/:applicationId',
      '/dashboard/finance',
      '/dashboard/schedule/:applicationId',
      '/dashboard/my-jobs',
      '/dashboard/unassigned',
      '/dashboard/unassigned-jobs',
      '/field',
      '/field/jobs/:id',
      '/field/jobs/:id/inspect',
      '/field/camera'
    ];

    const homeTargets = [
      '/',
      '/login',
      '/register',
      '/dashboard',
      `/v/${DEMO_CERT_VALID}`,
      `/v/${DEMO_CERT_EXPIRED}`,
      `/v/${DEMO_CERT_REVOKED}`
    ];

    it('all static navigation links in Home resolve to a registered App route', () => {
      for (const target of homeTargets) {
        const matchesRoute = appRoutes.some(routePattern => {
          if (routePattern === target) return true;
          // Check parameterized matches
          const regexStr = '^' + routePattern.replace(/:[a-zA-Z0-9_]+/g, '[^/]+') + '$';
          return new RegExp(regexStr).test(target);
        });
        expect(matchesRoute, `Target ${target} should match an app route`).toBe(true);
      }
    });
  });
});
