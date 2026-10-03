import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'storage', 'nishchay.db');

let unlinked = false;
try {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
  if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  unlinked = true;
} catch {
  // File is locked by a running process on Windows
}

const { runMigrations } = await import('../db/migrate.js');
const { seedDemoData } = await import('./seed.js');
const { db } = await import('../db/index.js');

if (!unlinked) {
  db.exec(`
    DELETE FROM certificate_complaints;
    DELETE FROM officer_rejections;
    DELETE FROM appointments;
    DELETE FROM application_documents;
    DELETE FROM inspection_photos;
    DELETE FROM inspections;
    DELETE FROM certificates;
    DELETE FROM receipts;
    DELETE FROM payments;
    DELETE FROM applications;
    DELETE FROM instruments;
    DELETE FROM businesses;
    DELETE FROM zones;
    DELETE FROM users;
    DELETE FROM counters;
  `);
}

runMigrations();
seedDemoData();
