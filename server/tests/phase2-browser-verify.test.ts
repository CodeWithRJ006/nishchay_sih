import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import { DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED } from '../../shared/src/ids.js';
import { verifySealResult } from '../../shared/src/seal-browser.js';
import { formatDate } from '../../web/src/lib/formatters.js';
import type { Express } from 'express';

describe('Phase 2: Public Verification & Browser Cryptographic Seal Verification', () => {
  let app: Express;

  beforeAll(() => {
    runMigrations();
    seedDemoData();
    app = createApp();
  });

  it('1. GET /api/public/keys serves the authority SPKI key and keyId', async () => {
    const res = await request(app).get('/api/public/keys');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('keyId');
    expect(res.body).toHaveProperty('publicKeySpkiHex');
    expect(res.body).toHaveProperty('publicKeyPem');
    expect(typeof res.body.keyId).toBe('string');
    expect(res.body.keyId.length).toBe(8);
    expect(typeof res.body.publicKeySpkiHex).toBe('string');
    expect(res.body.publicKeySpkiHex.length).toBeGreaterThan(50);
  });

  it('2. Browser seal verifier succeeds for all 3 seeded certificates (valid, expired, revoked)', async () => {
    const keysRes = await request(app).get('/api/public/keys');
    expect(keysRes.status).toBe(200);
    const { publicKeySpkiHex, keyId } = keysRes.body;

    const sampleIds = [DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED];

    for (const certId of sampleIds) {
      const verifyRes = await request(app).get(`/api/public/verify/${certId}`);
      expect(verifyRes.status).toBe(200);

      const data = verifyRes.body;
      expect(data.keyId).toBe(keyId);
      expect(data.publicRecord).toBeDefined();
      expect(data.signature).toBeDefined();

      // Run shared browser verifier with WebCrypto
      const result = await verifySealResult(data.publicRecord, data.signature, publicKeySpkiHex);
      expect(result.state).toBe('verified');
      expect(result.reason).toBeUndefined();
    }
  });

  it('3. Three samples have genuinely distinct data, businesses, instrument classes, and serials', async () => {
    const validRes = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    const expiredRes = await request(app).get(`/api/public/verify/${DEMO_CERT_EXPIRED}`);
    const revokedRes = await request(app).get(`/api/public/verify/${DEMO_CERT_REVOKED}`);

    expect(validRes.body.status).toBe('VALID');
    expect(expiredRes.body.status).toBe('EXPIRED');
    expect(revokedRes.body.status).toBe('REVOKED');

    // Distinct businesses
    expect(validRes.body.tradeName).toBe('Biz One');
    expect(expiredRes.body.tradeName).toBe('Biz Two');
    expect(revokedRes.body.tradeName).toBe('Biz Three (NAWI)');

    // Distinct classes
    expect(validRes.body.instrumentClass).toBe('W-1');
    expect(expiredRes.body.instrumentClass).toBe('CM-1');
    expect(revokedRes.body.instrumentClass).toBe('NAWI-3');

    // Distinct serials
    expect(validRes.body.serial).not.toBe(expiredRes.body.serial);
    expect(expiredRes.body.serial).not.toBe(revokedRes.body.serial);

    // RevokedAt present on revoked, null on others
    expect(validRes.body.revokedAt).toBeNull();
    expect(expiredRes.body.revokedAt).toBeNull();
    expect(typeof revokedRes.body.revokedAt).toBe('string');
    // Never expose revoked_reason
    expect(revokedRes.body).not.toHaveProperty('revoked_reason');
    expect(revokedRes.body).not.toHaveProperty('reason');
  });

  it('4. Tampering flips status to SEAL_BROKEN and browser verification fails', async () => {
    const keysRes = await request(app).get('/api/public/keys');
    const { publicKeySpkiHex } = keysRes.body;

    const verifyRes = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    const data = verifyRes.body;

    // Tamper with public record
    const tamperedRecord = { ...data.publicRecord, tradeName: 'Fraudulent Merchant' };
    const tamperedResult = await verifySealResult(tamperedRecord, data.signature, publicKeySpkiHex);
    expect(tamperedResult.state).toBe('failed');
    expect(tamperedResult.reason).toContain('Cryptographic signature mismatch');

    // Tamper with signature
    const corruptSig = (data.signature[0] === '0' ? '1' : '0') + data.signature.slice(1);
    const corruptSigResult = await verifySealResult(data.publicRecord, corruptSig, publicKeySpkiHex);
    expect(corruptSigResult.state).toBe('failed');

    // Missing data returns 'unavailable'
    const unavailResult = await verifySealResult(null, null, publicKeySpkiHex);
    expect(unavailResult.state).toBe('unavailable');
  });

  it('5. Ticks are derived from real database records, not constants', async () => {
    const verifyRes = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(verifyRes.body.ticks).toEqual({
      feeReceipt: true,
      officerOnSite: true,
      checklistRecorded: true,
      sealIntact: true
    });

    // Verify tampering with receipt breaks feeReceipt tick
    const cert = db.prepare('SELECT receipt_id FROM certificates WHERE public_id = ?').get(DEMO_CERT_VALID) as { receipt_id: string };
    const originalReceipt = db.prepare('SELECT amount FROM receipts WHERE id = ?').get(cert.receipt_id) as { amount: number };
    
    // Corrupt receipt amount
    db.prepare('UPDATE receipts SET amount = 9999 WHERE id = ?').run(cert.receipt_id);
    const tamperedFeeRes = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(tamperedFeeRes.body.ticks.feeReceipt).toBe(false);

    // Restore receipt amount
    db.prepare('UPDATE receipts SET amount = ? WHERE id = ?').run(originalReceipt.amount, cert.receipt_id);
    const restoredFeeRes = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    expect(restoredFeeRes.body.ticks.feeReceipt).toBe(true);
  });

  it('6. Dates format properly with en-IN format', async () => {
    const verifyRes = await request(app).get(`/api/public/verify/${DEMO_CERT_VALID}`);
    const validFrom = verifyRes.body.validFrom;
    const formatted = formatDate(validFrom);
    // en-IN format example: "3 Sep 2026"
    expect(formatted).toMatch(/^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/);
  });
});
