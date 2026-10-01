import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import path from 'node:path';
import fs from 'node:fs';

let app: express.Express;
let biz1Cookie: string;
let biz2Cookie: string;

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
  
  const schema = db.prepare('PRAGMA table_info(businesses)').all();
  console.log('BUSINESSES SCHEMA:', schema);

  seedDemoData();
  app = await createApp();
  
  // Create test directories if needed
  const storageDir = path.join(process.cwd(), 'storage');
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

  const res1 = await request(app).post('/api/auth/login').send({ email: 'biz1@example.com', password: 'demo123' });
  biz1Cookie = res1.headers['set-cookie'];

  const res2 = await request(app).post('/api/auth/login').send({ email: 'biz2@example.com', password: 'demo123' });
  biz2Cookie = res2.headers['set-cookie'];
});

describe('Block 4b Tests', () => {
  describe('Instruments', () => {
    it('creates an instrument and rejects duplicate serials for same business', async () => {
      const res = await request(app)
        .post('/api/instruments')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .send({ type_code: 'W-1', make: 'Mettler', model: 'M-1', capacity: '10kg', serial: 'SN-100' });
      
      expect(res.status).toBe(201);
      const id = res.body.id;
      expect(id).toMatch(/^NSH-I-/);

      // Duplicate serial
      const res2 = await request(app)
        .post('/api/instruments')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .send({ type_code: 'W-1', make: 'Mettler', model: 'M-2', capacity: '10kg', serial: 'SN-100' });
      
      expect(res2.status).toBe(409);

      // Business 2 can use same serial
      const res3 = await request(app)
        .post('/api/instruments')
        .set('Cookie', biz2Cookie)
        .set('x-csrf-token', 'test')
        .send({ type_code: 'W-1', make: 'Mettler', model: 'M-2', capacity: '10kg', serial: 'SN-100' });
      expect(res3.status).toBe(201);
    });

    it('enforces object-level access on getInstrument', async () => {
      const res = await request(app)
        .post('/api/instruments')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .send({ type_code: 'W-1', make: 'M', model: 'M', capacity: '10', serial: 'SN-999' });
      
      const id = res.body.id;

      const get2 = await request(app).get(`/api/instruments/${id}`).set('Cookie', biz2Cookie);
      expect(get2.status).toBe(403);

      const get1 = await request(app).get(`/api/instruments/${id}`).set('Cookie', biz1Cookie);
      expect(get1.status).toBe(200);
    });
  });

  describe('Uploads', () => {
    it('rejects svg / disguised extensions', async () => {
      // Create a fake SVG with PNG extension
      const svgBuffer = Buffer.from('<svg></svg>');
      
      const res = await request(app)
        .post('/api/upload')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .attach('file', svgBuffer, 'fake.png');

      expect(res.status).toBe(400); // Magic bytes check fails
    });

    it('accepts real magic bytes (mocking a tiny PNG) and stops path traversal', async () => {
      // 89 50 4E 47
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const res = await request(app)
        .post('/api/upload')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .attach('file', pngBuffer, 'real.png');

      expect(res.status).toBe(201);
      const { fileName } = res.body;

      // path traversal on download
      const res2 = await request(app)
        .get(`/api/documents/../../../etc/passwd`)
        .set('Cookie', biz1Cookie);
      expect(res2.status).toBe(404); // Invalid file name (doesn't match route)
    });
  });

  describe('Applications', () => {
    it('snapshots fee and enforces one pending app', async () => {
      const iRes = await request(app)
        .post('/api/instruments')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .send({ type_code: 'NAWI-3', make: 'M', model: 'M', capacity: '10', serial: 'SN-APP' });
      const instId = iRes.body.id;

      const appRes = await request(app)
        .post('/api/applications')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .send({
          instrument_id: instId,
          documents: [{ doc_type: 'INVOICE', file_name: 'test.pdf', file_hash: 'abcd' }]
        });
      
      expect(appRes.status).toBe(201);
      expect(appRes.body.fee_amount).toBe(500); // From NAWI-3 rule

      // Should block duplicate pending
      const appRes2 = await request(app)
        .post('/api/applications')
        .set('Cookie', biz1Cookie)
        .set('x-csrf-token', 'test')
        .send({
          instrument_id: instId,
          documents: [{ doc_type: 'INVOICE', file_name: 'test.pdf', file_hash: 'abcd' }]
        });
      expect(appRes2.status).toBe(409);
    });
  });
});
