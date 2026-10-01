import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

let app: express.Express;

beforeEach(() => {
  db.exec('PRAGMA foreign_keys = OFF');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Record<string, unknown>[];
  for (const table of tables) {
    if (table.name !== 'sqlite_sequence') {
      db.exec(`DROP TABLE IF EXISTS ${table.name}`);
    }
  }
  db.exec('PRAGMA foreign_keys = ON');

  runMigrations();
  seedDemoData();
  app = createApp();
});

describe('Auth Flow', () => {
  it('should login and set httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'biz1@example.com', password: 'demo123' });
    
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('BUSINESS');
    
    const rawCookies = res.headers['set-cookie'];
    const cookies = rawCookies ? (Array.isArray(rawCookies) ? rawCookies : [rawCookies]) : [];
    expect(cookies.some((c: string) => c.includes('HttpOnly') && c.includes('token='))).toBe(true);
  });

  it('should logout and clear cookie', async () => {
    const res = await request(app).post('/api/auth/logout').send();
    expect(res.status).toBe(200);
    const rawCookies = res.headers['set-cookie'];
    const cookies = rawCookies ? (Array.isArray(rawCookies) ? rawCookies : [rawCookies]) : [];
    expect(cookies.some((c: string) => c.includes('token=;') || c.includes('Expires='))).toBe(true);
  });

  it('should return 401 for bad credentials and uniform error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'biz1@example.com', password: 'wrong' });
    
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should lock out after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: 'admin@nishchay.gov.in', password: 'wrong' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@nishchay.gov.in', password: 'demo123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Account locked');
  });
});
