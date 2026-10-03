import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import fs from 'node:fs';

describe('Phase 1c Tests', () => {
  const app = createApp();

  beforeAll(() => {
    process.env.DEMO_MODE = 'true';
    runMigrations();
    seedDemoData();
  });

  it('role switcher changes the signed-in role for all 4 seeded roles', async () => {
    const roles = ['ADMIN', 'LMO', 'GATC', 'BUSINESS'];

    for (const role of roles) {
      const res = await request(app).post(`/api/demo/login-as/${role}`);
      expect(res.status).toBe(200);
      expect(res.body.role).toBe(role);
      expect(res.headers['set-cookie']).toBeDefined();
    }
  });

  it('every sidebar link in DesktopShell resolves to a defined route in App.tsx', () => {
    const shellCode = fs.readFileSync('web/src/layouts/DesktopShell.tsx', 'utf-8');
    const appCode = fs.readFileSync('web/src/App.tsx', 'utf-8');

    // Extract all `to: '...'` links
    const linkMatches = [...shellCode.matchAll(/to:\s*['"]([^'"]+)['"]/g)];
    expect(linkMatches.length).toBeGreaterThan(0);

    const routes = linkMatches.map(m => m[1]);

    for (const route of routes) {
      // In App.tsx, subroutes are either <Route path="sub" or <Route index or absolute
      if (route === '/dashboard') {
        expect(appCode).toContain('path="/dashboard"');
      } else {
        const subPath = route.replace('/dashboard/', '');
        const hasRoute = appCode.includes(`path="${subPath}"`) || appCode.includes(`path="${route}"`);
        expect(hasRoute).toBe(true);
      }
    }
  });

  it('DesktopShell contains responsive mobile menu button for screens below 1024px', () => {
    const shellCode = fs.readFileSync('web/src/layouts/DesktopShell.tsx', 'utf-8');
    expect(shellCode).toContain('lg:hidden');
    expect(shellCode).toContain('lg:w-64');
    expect(shellCode).toContain('overflow-x-hidden');
    expect(shellCode).toContain('aria-label="Toggle navigation menu"');
  });

  it('DesktopShell displays human role labels instead of raw role codes', () => {
    const shellCode = fs.readFileSync('web/src/layouts/DesktopShell.tsx', 'utf-8');
    expect(shellCode).toContain("'Legal Metrology Officer'");
    expect(shellCode).toContain("'Government Approved Test Centre'");
    expect(shellCode).toContain("'Administrator'");
    expect(shellCode).toContain("'Business'");
  });
});
