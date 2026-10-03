import { describe, it, expect, beforeAll } from 'vitest';
import { verifyFullSeal } from '../seal/verifyFull.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';
import { db } from '../db/index.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Full Seal Verification (Private + Public + Photos)', () => {
  beforeAll(() => {
    runMigrations();
    seedDemoData();
  });

  it('seeded certificate verifies VALID', () => {
    const cert = db.prepare('SELECT public_id FROM certificates LIMIT 1').get() as { public_id: string };
    const isValid = verifyFullSeal(cert.public_id);
    expect(isValid).toBe(true);
  });

  it('fails if private field (checklist) is mutated', () => {
    const cert = db.prepare('SELECT public_id, application_id FROM certificates LIMIT 1').get() as { public_id: string; application_id: string; public_record: string; signature: string };
    db.prepare('UPDATE inspections SET checklist = ? WHERE application_id = ?').run(JSON.stringify(['mutated']), cert.application_id);
    expect(verifyFullSeal(cert.public_id)).toBe(false);
    // revert
    db.prepare('UPDATE inspections SET checklist = ? WHERE application_id = ?').run(JSON.stringify(['ok']), cert.application_id);
  });

  it('fails if photo byte is mutated', () => {
    const cert = db.prepare('SELECT public_id, application_id FROM certificates LIMIT 1').get() as { public_id: string; application_id: string };
    const photo = db.prepare('SELECT file_name FROM inspection_photos WHERE application_id = ? LIMIT 1').get(cert.application_id) as { file_name: string };
    const storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage', 'uploads');
    const photoPath = path.join(storageDir, photo.file_name);
    const original = fs.readFileSync(photoPath);
    
    // Mutate one byte
    const mutated = Buffer.from(original);
    mutated[0] = mutated[0] ^ 0xFF;
    fs.writeFileSync(photoPath, mutated);
    
    expect(verifyFullSeal(cert.public_id)).toBe(false);
    
    // revert
    fs.writeFileSync(photoPath, original);
  });

  it('fails if public field is mutated', () => {
    const cert = db.prepare('SELECT public_id, public_record FROM certificates LIMIT 1').get() as { public_id: string; application_id: string; public_record: string; signature: string };
    const rec = JSON.parse(cert.public_record);
    rec.certNo = 'NSH-C-999'; // mutated
    db.prepare('UPDATE certificates SET public_record = ? WHERE public_id = ?').run(JSON.stringify(rec), cert.public_id);
    
    expect(verifyFullSeal(cert.public_id)).toBe(false);
    
    // revert
    db.prepare('UPDATE certificates SET public_record = ? WHERE public_id = ?').run(cert.public_record, cert.public_id);
  });

  it('fails if signature is mutated', () => {
    const cert = db.prepare('SELECT public_id, signature FROM certificates LIMIT 1').get() as { public_id: string; application_id: string; public_record: string; signature: string };
    const mutatedSig = (cert.signature[0] === '0' ? '1' : '0') + cert.signature.substring(1);
    db.prepare('UPDATE certificates SET signature = ? WHERE public_id = ?').run(mutatedSig, cert.public_id);
    
    expect(verifyFullSeal(cert.public_id)).toBe(false);
    
    // revert
    db.prepare('UPDATE certificates SET signature = ? WHERE public_id = ?').run(cert.signature, cert.public_id);
  });
});
