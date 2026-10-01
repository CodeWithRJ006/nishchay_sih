import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';

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

describe('Audit Log Triggers', () => {
  it('prevents update and delete on audit_log table', () => {
    db.prepare('INSERT INTO audit_log (id, table_name, record_id, action) VALUES (?, ?, ?, ?)')
      .run('AUDIT-1', 'users', 'USR-1', 'CREATE');
    
    expect(() => {
      db.prepare("UPDATE audit_log SET action = 'UPDATE' WHERE id = 'AUDIT-1'").run();
    }).toThrow('Update on audit_log is prohibited');

    expect(() => {
      db.prepare("DELETE FROM audit_log WHERE id = 'AUDIT-1'").run();
    }).toThrow('Delete on audit_log is prohibited');
  });
});
