import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemoData } from '../scripts/seed.js';
import { DEMO_CERT_VALID } from '../../shared/src/ids.js';
import { certificatePdfService } from '../services/certificatePdfService.js';
import type { Express } from 'express';

describe('Certificate PDF & QR Verification', () => {
  let app: Express;

  beforeAll(async () => {
    runMigrations();
    seedDemoData();
    app = createApp();
  });

  it('createPdf generates valid A4 PDF bytes with %PDF magic header', async () => {
    const pdfBytes = await certificatePdfService.createPdf(DEMO_CERT_VALID);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('createPdf respects dynamic baseUrl for live QR scanning', async () => {
    const customBase = 'https://nishchay.onrender.com';
    const pdfBytes = await certificatePdfService.createPdf(DEMO_CERT_VALID, customBase);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });

  it('GET /api/certificates/:publicId/pdf returns designed PDF with Content-Type application/pdf', async () => {
    const res = await request(app)
      .get(`/api/certificates/${DEMO_CERT_VALID}/pdf`)
      .set('Host', 'nishchay.onrender.com');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(`certificate-${DEMO_CERT_VALID}.pdf`);
    expect(res.body.toString('latin1', 0, 5)).toBe('%PDF-');
  });
});
