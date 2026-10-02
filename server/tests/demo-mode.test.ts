import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';

describe('DEMO_MODE startup behavior', () => {
  beforeAll(() => {
    runMigrations();
    seedDemoData();
  });

  it('creates keys and seeds database when STORAGE_DIR and keys are empty', () => {
    // Check db has users
    const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
    expect(usersCount.c).toBeGreaterThan(0);
    
    // Check keys were created
    const keysDir = path.join(process.cwd(), '.keys');
    expect(fs.existsSync(path.join(keysDir, 'private.pem'))).toBe(true);
    expect(fs.existsSync(path.join(keysDir, 'public.pem'))).toBe(true);
  });
});
