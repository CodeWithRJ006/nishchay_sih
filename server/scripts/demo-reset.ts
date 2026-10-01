import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'storage', 'nishchay.db');

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

// Now import the rest
const { runMigrations } = await import('../db/migrate.js');
const { seedDemoData } = await import('./seed.js');

runMigrations();
seedDemoData();
console.log('Database reset and seeded.');
