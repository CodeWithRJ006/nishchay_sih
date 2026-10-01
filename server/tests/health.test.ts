import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { clock } from '../../shared/index.js';

describe('Health Check & Shared', () => {
  it('GET /api/health should return ok', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('shared clock should be accessible', () => {
    expect(clock.now()).toBeGreaterThan(0);
  });
});
