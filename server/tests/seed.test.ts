import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

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
});

describe('Seed Determinism', () => {
  it('seeding twice does not duplicate data and is deterministic', () => {
    seedDemoData();
    const count1 = (db.prepare('SELECT COUNT(*) as c FROM users').get() as Record<string, unknown>).c;
    
    seedDemoData();
    const count2 = (db.prepare('SELECT COUNT(*) as c FROM users').get() as Record<string, unknown>).c;
    
    expect(count1).toBeGreaterThan(0);
    expect(count1).toBe(count2);
    
    const admin = db.prepare("SELECT * FROM users WHERE id = 'USR-ADMIN'").get() as Record<string, unknown>;
    expect(admin.role).toBe('ADMIN');
  });
});
