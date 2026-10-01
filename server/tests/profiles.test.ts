import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

let app: express.Express;

beforeEach(async () => {
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
  app = await createApp();
});

describe('Block 4a API', () => {
  it('Admin can provision accounts', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@nishchay.gov.in', password: 'demo123' });
    const cookie = login.headers['set-cookie'];

    const res = await request(app)
      .post('/api/admin/provision')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'test')
      .send({ email: 'new_lmo@test.com', name: 'New LMO', role: 'LMO', zone_id: 'ZONE-1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Provisioned');
  });

  it('Non-admin cannot provision accounts (403 Forbidden)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'biz1@example.com', password: 'demo123' });
    const cookie = login.headers['set-cookie'];

    const res = await request(app)
      .post('/api/admin/provision')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'test')
      .send({ email: 'new_lmo@test.com', name: 'New LMO', role: 'LMO' });

    expect(res.status).toBe(403);
  });

  it('Business A cannot read or modify Business B (object policy)', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'biz1@example.com', password: 'demo123' });
    const cookie = login.headers['set-cookie'];

    // Try to update Biz 2's profile by passing their ID. The endpoint normally doesn't take ID to change others, 
    // but the object policy should reject if we simulate an ID of another business.
    const res = await request(app)
      .put('/api/business/profile')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'test')
      .send({ id: 'BIZ-2', name: 'Hacked Name' }); // BIZ-2 is owned by biz2@example.com

    expect(res.status).toBe(403);
    
    // Changing own business works
    const res2 = await request(app)
      .put('/api/business/profile')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'test')
      .send({ id: 'BIZ-1', name: 'Updated Name', address: '123 Market', zone_id: 'ZONE-1' }); // BIZ-1 is owned by biz1@example.com
      
    expect(res2.status).toBe(200);
  });
});
