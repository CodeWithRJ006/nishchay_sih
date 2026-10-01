import fs from 'node:fs';
import path from 'node:path';
import { db } from './index.js';

export function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'server', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applyMigration = db.transaction((file: string, sql: string) => {
    const row = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(file);
      if (!row) {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
      }
  });

  for (const file of files) {
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (sql.charCodeAt(0) === 0xFEFF) {
      sql = sql.slice(1);
    }
    applyMigration(file, sql);
  }
}
