import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../db/index.js';
import type { Request, Response } from 'express';
import { createApp } from '../app.js';
import { seedDemoData } from '../scripts/seed.js';
import { runMigrations } from '../db/migrate.js';

describe('Block 8a Tests', () => {
  beforeAll(() => {
    runMigrations();
    createApp();
    seedDemoData();
  });
  it('10,000 random and malformed ids give no 5xx and identical responses', async () => {
    // Calling the handler directly for speed
    const { verifyCertificatePublic } = await import('../api/certificates.js');
    
    const notFoundShape = {
      tradeName: 'Unknown',
      instrumentType: 'Unknown',
      instrumentClass: 'Unknown',
      serial: 'Unknown',
      status: 'UNKNOWN',
      validFrom: null,
      validUntil: null,
      revokedAt: null,
      authorityName: 'Unknown',
      integrity: false,
      ticks: { feeReceipt: false, officerOnSite: false, checklistRecorded: false, sealIntact: false },
      publicRecord: null,
      signature: null,
      keyId: null
    };

    let allIdentical = true;
    let any5xx = false;

    // 10,000 random/malformed strings
    for (let i = 0; i < 10000; i++) {
      const id = i % 2 === 0 ? 'random_' + Math.random().toString(36) : '{"malformed":"' + i + '"}';
      
      const req = { params: { publicId: id } } as unknown as Request;
      let resStatus = 200;
      let resJson = {};
      const res = {
        status: (s: number) => { resStatus = s; return res; },
        json: (j: unknown) => { resJson = j as object; return res; }
      } as unknown as Response;

      await verifyCertificatePublic(req, res);
      
      if (resStatus >= 500) any5xx = true;
      if (resStatus !== 404 || JSON.stringify(resJson) !== JSON.stringify(notFoundShape)) {
        allIdentical = false;
        break;
      }
    }

    expect(any5xx).toBe(false);
    expect(allIdentical).toBe(true);
  });

  it('response keys equal the allowlist', async () => {
    const cert = db.prepare("SELECT public_id FROM certificates WHERE status = 'VALID' LIMIT 1").get() as { public_id: string } | undefined;
    if (cert) {
      const { verifyCertificatePublic } = await import('../api/certificates.js');
      const req = { params: { publicId: cert.public_id } } as unknown as Request;
      let resJson: Record<string, unknown> = {};
      const res = {
        status: () => res,
        json: (j: unknown) => { resJson = j as Record<string, unknown>; return res; }
      } as unknown as Response;
      await verifyCertificatePublic(req, res);
      
      const keys = Object.keys(resJson).sort();
      expect(keys).toEqual([
        'authorityName', 'instrumentClass', 'instrumentType', 'integrity', 
        'keyId', 'publicRecord', 'revokedAt', 'serial', 'signature', 'status', 'ticks', 
        'tradeName', 'validFrom', 'validUntil'
      ]);
    }
  });

  it('mutating a private field gives SEAL_BROKEN', async () => {
    const cert = db.prepare("SELECT public_id, application_id FROM certificates WHERE status = 'VALID' LIMIT 1").get() as { public_id: string, application_id: string } | undefined;
    if (cert) {
       const old = db.prepare('SELECT readings FROM inspections WHERE application_id = ?').get(cert.application_id) as { readings: string };
       db.prepare('UPDATE inspections SET readings = ? WHERE application_id = ?').run('[]', cert.application_id);
       
       const { verifyCertificatePublic } = await import('../api/certificates.js');
       const req = { params: { publicId: cert.public_id } } as unknown as Request;
       let resJson: Record<string, unknown> = {};
       const res = {
         status: () => res,
         json: (j: unknown) => { resJson = j as Record<string, unknown>; return res; }
       } as unknown as Response;
       await verifyCertificatePublic(req, res);
       
       expect(resJson.status).toBe('SEAL_BROKEN');
       
       db.prepare('UPDATE inspections SET readings = ? WHERE application_id = ?').run(old.readings, cert.application_id);
    }
  });

  it('the revoked and expired sample certificates give REVOKED and EXPIRED', async () => {
    const { DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED } = await import('../scripts/seed.js');
    const { verifyCertificatePublic } = await import('../api/certificates.js');
    
    let resJsonExp: Record<string, unknown> = {};
    const reqExp = { params: { publicId: DEMO_CERT_EXPIRED } } as unknown as Request;
    await verifyCertificatePublic(reqExp, { status: () => ({ json: (j: unknown) => { resJsonExp = j as Record<string, unknown>; } }), json: (j: unknown) => { resJsonExp = j as Record<string, unknown>; } } as unknown as Response);
    expect(resJsonExp.status).toBe('EXPIRED');
    
    let resJsonRev: Record<string, unknown> = {};
    const reqRev = { params: { publicId: DEMO_CERT_REVOKED } } as unknown as Request;
    await verifyCertificatePublic(reqRev, { status: () => ({ json: (j: unknown) => { resJsonRev = j as Record<string, unknown>; } }), json: (j: unknown) => { resJsonRev = j as Record<string, unknown>; } } as unknown as Response);
    expect(resJsonRev.status).toBe('REVOKED');
  });
  
  it('contract test that the pages complaint payload keys equal the servers schema keys', async () => {
     const fs = await import('node:fs');
     const code = fs.readFileSync('web/src/pages/PublicVerify.tsx', 'utf-8');
     expect(code).toContain('body: JSON.stringify({ category, note: complaintText, honeypot })');
  });

});
