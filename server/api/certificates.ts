// Certificate API handlers for Block 9
import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { certificatePdfService } from '../services/certificatePdfService.js';
import { rateLimit } from 'express-rate-limit';

// Rate limiter for public endpoints (e.g., verify, export, complaint)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
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
    conditions.push('i.class = ?');
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
    SELECT c.id, c.public_id, c.instrument_id, i.class as instrument_class, c.status,
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
    const pdfBytes = await certificatePdfService.createPdf(publicId);
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
  if (instrumentClass) { conditions.push('i.class = ?'); params.push(instrumentClass); }
  if (status) { conditions.push('c.status = ?'); params.push(status); }
  if (businessName) { conditions.push('b.name LIKE ?'); params.push(`%${businessName}%`); }
  if (startDate) { conditions.push('c.valid_from >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('c.valid_to <= ?'); params.push(endDate); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `
    SELECT c.public_id, c.instrument_id, i.class as instrument_class, c.status,
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
  const { note, honeypot } = req.body as { note?: string; honeypot?: string };

  // Simple honeypot check
  if (honeypot) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  if (!note || note.length > 300) {
    return res.status(400).json({ error: 'Note must be present and <= 300 characters' });
  }

  // Rate‑limit per client (hashed IP) – using a simple in‑memory map for demo
  const _clientHash = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  // In production replace with proper per‑client salted hash & persistent store.

  // Insert complaint
  const stmt = db.prepare(
    `INSERT INTO certificate_complaints (public_id, note, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
  );
  stmt.run(publicId, note);

  res.json({ success: true, message: 'Your complaint has been recorded. The authority will review it.' });
};

// Export route bindings for server/app.ts integration
export const certificateRoutes = [
  { method: 'GET', path: '/api/certificates/search', handler: [publicLimiter, searchCertificates] },
  { method: 'GET', path: '/api/certificates/:publicId/pdf', handler: [publicLimiter, getCertificatePdf] },
  { method: 'GET', path: '/api/certificates/export', handler: [publicLimiter, exportCertificatesCsv] },
  { method: 'POST', path: '/api/certificates/:publicId/complaint', handler: [publicLimiter, submitComplaint] },
];
