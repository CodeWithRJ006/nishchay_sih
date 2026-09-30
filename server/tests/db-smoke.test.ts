import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('Database Smoke Test', () => {
  it('should run SELECT 1 on an in-memory database', () => {
    const db = new Database(':memory:');
    const row = db.prepare('SELECT 1 as val').get() as { val: number };
    expect(row.val).toBe(1);
    db.close();
  });
});
