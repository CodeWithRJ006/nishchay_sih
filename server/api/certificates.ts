// Certificate API handlers for Block 9
import { Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { certificatePdfService } from '../services/certificatePdfService.js';
import { certificateService } from '../services/certificateService.js';
import { rateLimit } from 'express-rate-limit';
import { verifyFullSeal } from '../seal/verifyFull.js';
import { ensureKeys } from '../seal/keys.js';
import { hmacSecret } from '../config/secrets.js';
import { clock } from '../../shared/src/clock.js';

// Rate limiter for public endpoints (e.g., verify, export, complaint)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const getDailySalt = () => new Date().toISOString().split('T')[0];
const hashIp = (ip: string) => crypto.createHash('sha256').update(ip + getDailySalt()).digest('hex');

const complaintClientLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5,
  keyGenerator: (req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    return hashIp(typeof ip === 'string' ? ip : ip[0]);
  },
  message: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests from this client' }
});

const complaintCertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10,
  keyGenerator: (req) => req.params.publicId,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests for this certificate' }
});

/**
 * GET /api/certificates/search
 * Query parameters: instrumentId, businessName, startDate, endDate, class, status, sort, order, page, pageSize
 */
export const searchCertificates = async (req: Request, res: Response) => {
  const {
    instrumentId,
    businessName,
    startDate,
    endDate,
    class: instrumentClass,
    status,
    sort = 'valid_to',
    order = 'DESC',
    page = '1',
    pageSize = '25',
  } = req.query as Record<string, string>;

  const offset = (Number(page) - 1) * Number(pageSize);
  const limit = Number(pageSize);

  // Build WHERE clauses safely using parameters
  const conditions: string[] = [];
  const params: (string | number)[] = []; // concrete types for query parameters

  if (instrumentId) {
    conditions.push('c.instrument_id = ?');
    params.push(instrumentId);
  }
  if (instrumentClass) {
    conditions.push('i.type_code = ?');
    params.push(instrumentClass);
  }
  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }
  if (businessName) {
    conditions.push('b.name LIKE ?');
    params.push(`%${businessName}%`);
  }
  if (startDate) {
    conditions.push('c.valid_from >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('c.valid_to <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `
    SELECT c.id, c.public_id, c.instrument_id, i.type_code as instrument_class, c.status,
           c.valid_from, c.valid_to, b.name as business_name
    FROM certificates c
    JOIN instruments i ON c.instrument_id = i.id
    JOIN businesses b ON i.business_id = b.id
    ${whereClause}
    ORDER BY ${sort} ${order}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(sql).all(...params, limit, offset);
  res.json({ results: rows, page: Number(page), pageSize: limit });
};

/**
 * GET /api/certificates/:publicId/pdf
 * Returns generated PDF for a certificate.
 */
export const getCertificatePdf = async (req: Request, res: Response) => {
  const { publicId } = req.params;
  try {
    const host = req.get('host');
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto || req.protocol || 'http';
    const reqBase = host ? `${protocol}://${host}` : undefined;
    const pdfBytes = await certificatePdfService.createPdf(publicId, reqBase);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${publicId}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * GET /api/certificates/export
 * Exports the current filtered view as CSV.
 */
export const exportCertificatesCsv = async (req: Request, res: Response) => {
  // Reuse search logic without pagination
  const {
    instrumentId,
    businessName,
    startDate,
    endDate,
    class: instrumentClass,
    status,
    sort = 'valid_to',
    order = 'DESC',
  } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (instrumentId) { conditions.push('c.instrument_id = ?'); params.push(instrumentId); }
  if (instrumentClass) { conditions.push('i.type_code = ?'); params.push(instrumentClass); }
  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (businessName) { conditions.push('b.name LIKE ?'); params.push(`%${businessName}%`); }
  if (startDate) { conditions.push('c.valid_from >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('c.valid_to <= ?'); params.push(endDate); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `
    SELECT c.public_id, c.instrument_id, i.type_code as instrument_class, c.status,
           c.valid_from, c.valid_to, b.name as business_name
    FROM certificates c
    JOIN instruments i ON c.instrument_id = i.id
    JOIN businesses b ON i.business_id = b.id
    ${whereClause}
    ORDER BY ${sort} ${order}
  `;

  const rows = db.prepare(sql).all(...params) as { public_id: string; instrument_id: string; instrument_class: string; status: string; valid_from: string; valid_to: string; business_name: string }[];

  // CSV header
  const header = ['Public ID', 'Instrument ID', 'Class', 'Status', 'Valid From', 'Valid To', 'Business Name'];
  const lines = [header.join(',')];

  const escapeCell = (value: unknown) => {
    const str = String(value ?? '');
    if (/^[=+\-@\t]/.test(str)) {
      return `"'${str.replace(/"/g, '""')}"`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  for (const row of rows) {
    const line = [
      escapeCell(row.public_id),
      escapeCell(row.instrument_id),
      escapeCell(row.instrument_class),
      escapeCell(row.status),
      escapeCell(row.valid_from),
      escapeCell(row.valid_to),
      escapeCell(row.business_name),
    ].join(',');
    lines.push(line);
  }

  const csv = lines.join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="certificates.csv"');
  res.send(csv);
};

/**
 * POST /api/certificates/:publicId/complaint
 * Right‑to‑Check complaint endpoint.
 */
export const submitComplaint = async (req: Request, res: Response) => {
  const { publicId } = req.params;
  const { note, category = 'Other', honeypot } = req.body as { note?: string; category?: string; honeypot?: string };

  // Simple honeypot check
  if (honeypot) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  if (note && note.length > 300) {
    return res.status(400).json({ error: 'Note must be <= 300 characters' });
  }

  // Insert complaint
  const stmt = db.prepare(
    `INSERT INTO certificate_complaints (public_id, note, category, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  );
  stmt.run(publicId, note || '', category);

  res.json({ success: true, message: 'Your complaint has been recorded. The authority will review it.' });
};

// Export route bindings for server/app.ts integration

export const getPublicKeys = async (req: Request, res: Response) => {
  const { keyId, publicKeySpkiHex, publicKey } = ensureKeys();
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  res.json({
    keyId,
    publicKeySpkiHex,
    publicKeyPem,
    keys: [
      {
        keyId,
        publicKeySpkiHex,
        publicKeyPem,
      }
    ]
  });
};

export const verifyCertificatePublic = async (req: Request, res: Response) => {
  const { publicId } = req.params;
  
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
    ticks: {
      feeReceipt: false,
      officerOnSite: false,
      checklistRecorded: false,
      sealIntact: false
    },
    publicRecord: null,
    signature: null,
    keyId: null
  };

  try {
    const cert = await certificateService.getCertificate(publicId);
    const isIntact = verifyFullSeal(publicId);
    
    let status = 'VALID';
    if (!isIntact) {
      status = 'SEAL_BROKEN';
    } else if (cert.status === 'REVOKED') {
      status = 'REVOKED';
    } else if (new Date(cert.valid_to as string).getTime() < clock.now()) {
      status = 'EXPIRED';
    }

    const publicRecord = JSON.parse(cert.public_record as string);

    // Dynamic data-driven ticks:
    // 1. Fee receipt (receipt exists, HMAC signature valid, amount equals the fee snapshot)
    const app = db.prepare('SELECT fee_amount FROM applications WHERE id = ?').get(cert.application_id) as { fee_amount: number } | undefined;
    const receipt = db.prepare('SELECT id, amount, signature, created_at FROM receipts WHERE id = ?').get(cert.receipt_id) as { id: string; amount: number; signature: string; created_at: string } | undefined;
    
    let feeReceiptValid = false;
    if (app && receipt && receipt.amount === app.fee_amount) {
      const payload = `${receipt.id}:${cert.application_id}:${cert.instrument_id}:${receipt.amount}:${receipt.created_at}`;
      const hmac = crypto.createHmac('sha256', hmacSecret());
      hmac.update(payload);
      if (hmac.digest('hex') === receipt.signature) {
        feeReceiptValid = true;
      }
    }

    // 2. Officer on site (arrival record exists)
    const hasArrival = Boolean(
      db.prepare("SELECT 1 FROM appointments WHERE application_id = ? AND status IN ('ARRIVED', 'COMPLETED')").get(cert.application_id) ||
      db.prepare("SELECT 1 FROM audit_log WHERE record_id = ? AND action = 'ARRIVED'").get(cert.application_id) ||
      db.prepare("SELECT 1 FROM inspections WHERE application_id = ? AND officer_id IS NOT NULL AND gps_lat IS NOT NULL").get(cert.application_id)
    );

    // 3. Checklist recorded (checklist and readings stored)
    const inspection = db.prepare('SELECT checklist, readings FROM inspections WHERE application_id = ?').get(cert.application_id) as { checklist: string; readings: string } | undefined;
    let checklistValid = false;
    if (inspection && inspection.checklist && inspection.readings) {
      try {
        const cl = JSON.parse(inspection.checklist);
        const rd = JSON.parse(inspection.readings);
        checklistValid = Array.isArray(cl) && cl.length > 0 && Array.isArray(rd) && rd.length > 0;
      } catch {
        checklistValid = false;
      }
    }

    // 4. Seal intact
    const sealIntact = isIntact;

    res.json({
      tradeName: publicRecord.tradeName || 'Unknown',
      instrumentType: publicRecord.instrumentType || 'Unknown',
      instrumentClass: publicRecord.instrumentClass || 'Unknown',
      serial: publicRecord.serialNo || 'Unknown',
      status,
      validFrom: publicRecord.validFrom || null,
      validUntil: publicRecord.validTo || null,
      revokedAt: (cert.revoked_at as string) || null,
      authorityName: publicRecord.authorityName || 'Unknown',
      integrity: isIntact,
      ticks: {
        feeReceipt: feeReceiptValid,
        officerOnSite: hasArrival,
        checklistRecorded: checklistValid,
        sealIntact
      },
      publicRecord,
      signature: cert.signature,
      keyId: cert.key_id
    });
  } catch {
    res.status(404).json(notFoundShape);
  }
};

export const getCertificatePublic = async (req: Request, res: Response) => {
  const { publicId } = req.params;
  try {
    const cert = await certificateService.getCertificate(publicId);
    res.json(cert);
  } catch {
    res.status(404).json({ error: 'Certificate not found' });
  }
};

export const revokeCertificate = async (req: Request, res: Response) => {
  const { publicId } = req.params;
  const { reason } = req.body as { reason?: string };
  const user = req.user as { id: string, role: string };
  
  if (!reason) {
    return res.status(400).json({ error: 'Revocation reason is required' });
  }

  try {
    await certificateService.revokeCertificate(publicId, reason, user.id);
    res.json({ success: true, message: 'Certificate revoked' });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
};

export const certificateRoutes = [
  { method: 'GET', path: '/api/certificates/search', handler: [publicLimiter, searchCertificates] },
  { method: 'GET', path: '/api/certificates/export', handler: [publicLimiter, exportCertificatesCsv] },
  { method: 'GET', path: '/api/certificates/:publicId', handler: [publicLimiter, getCertificatePublic] },
  { method: 'POST', path: '/api/certificates/:publicId/revoke', handler: [revokeCertificate] },
  { method: 'GET', path: '/api/certificates/:publicId/pdf', handler: [publicLimiter, getCertificatePdf] },
  
  { method: 'GET', path: '/api/public/keys', handler: [publicLimiter, getPublicKeys] },
  { method: 'GET', path: '/api/public/verify/:publicId', handler: [publicLimiter, verifyCertificatePublic] },
  { method: 'POST', path: '/api/public/certificates/:publicId/complaints', handler: [publicLimiter, complaintClientLimiter, complaintCertLimiter, submitComplaint] },
  
  // Kept for backward compatibility
  { method: 'POST', path: '/api/certificates/:publicId/complaint', handler: [publicLimiter, submitComplaint] },
];
