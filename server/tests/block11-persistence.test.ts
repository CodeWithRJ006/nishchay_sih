import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData, DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED } from '../scripts/seed.js';
import { ensureKeys, signHash } from '../seal/index.js';
import { verifyFullSeal } from '../seal/verifyFull.js';
import crypto from 'node:crypto';

describe('Persistence and fixed sample certificates', () => {
  beforeAll(() => {
    runMigrations();
  });

  it('Loading keys from SEAL_PRIVATE_KEY is deterministic', () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    const base64 = Buffer.from(pem).toString('base64');

    process.env.SEAL_PRIVATE_KEY = base64;
    const keys1 = ensureKeys();
    const keys2 = ensureKeys();
    delete process.env.SEAL_PRIVATE_KEY;

    expect(keys1.keyId).toBe(keys2.keyId);

    const testHash = crypto.createHash('sha256').update('test').digest('hex');
    const sig = signHash(testHash, keys1.privateKey);
    const verified = crypto.createVerify('sha256').update('nishchay-seal-v1:' + testHash).verify({ key: keys2.publicKey, dsaEncoding: 'ieee-p1363' }, sig, 'hex');
    expect(verified).toBe(true);
  });

  it('Seeding is deterministic and creates the three fixed IDs', () => {
    seedDemoData();
    seedDemoData(); // run twice

    const count = db.prepare(`SELECT COUNT(*) as c FROM certificates WHERE public_id IN (?, ?, ?)`).get(DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED) as { c: number };
    expect(count.c).toBe(3);
  });

  it('Fixed certificates have correct statuses', () => {
    const getStatus = (id: string) => (db.prepare('SELECT status FROM certificates WHERE public_id = ?').get(id) as { status: string }).status;
    expect(getStatus(DEMO_CERT_VALID)).toBe('VALID');
    expect(getStatus(DEMO_CERT_EXPIRED)).toBe('EXPIRED');
    expect(getStatus(DEMO_CERT_REVOKED)).toBe('REVOKED');
  });

  it('Fixed certificates verify correctly', () => {
    // We expect verifyFullSeal to pass for all three (meaning their signatures and hashes are correct)
    const res1 = verifyFullSeal(DEMO_CERT_VALID);
    expect(res1).toBe(true);

    const res2 = verifyFullSeal(DEMO_CERT_EXPIRED);
    expect(res2).toBe(true);

    const res3 = verifyFullSeal(DEMO_CERT_REVOKED);
    expect(res3).toBe(true);
  });
});
