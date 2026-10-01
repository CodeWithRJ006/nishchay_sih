import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';


const dbPath = process.env.NODE_ENV === 'test' 
  ? ':memory:' 
  : path.join(process.cwd(), 'storage', 'nishchay.db');

if (process.env.NODE_ENV !== 'test') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}
