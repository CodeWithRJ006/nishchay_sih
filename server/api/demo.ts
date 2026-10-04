// Demo API handlers (Block 10)
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { jwtSecret } from '../config/secrets.js';
import { certificateService } from '../services/certificateService.js';
import { execSync } from 'node:child_process';

/**
 * GET /api/demo/progress
 * Returns boolean flags for each step of the trust loop for the signed‑in demo business.
 */
export const getDemoProgress = (req: Request, res: Response) => {
  const user = (req as unknown as Request).user as { id: string; role: string } | undefined;
  const targetUserId = (user && user.role === 'BUSINESS') ? user.id : 'USR-BIZ1';

  // Helper to check existence of a query result
  const exists = (sql: string, params?: (string | number)[]) => !!db.prepare(sql).get(...(params || []));

  const hasBusiness = exists('SELECT 1 FROM businesses WHERE owner_id = ?', [targetUserId]);
  const hasApplication = exists('SELECT 1 FROM applications WHERE business_id = ?', [targetUserId]);
  const hasReceipt = exists(
    `SELECT 1 FROM receipts r
     JOIN applications a ON r.application_id = a.id
     WHERE a.business_id = ?`,
    [targetUserId]
  );
  const hasSchedule = exists(
    `SELECT 1 FROM appointments ap
     JOIN applications a ON ap.application_id = a.id
     WHERE a.business_id = ?`,
    [targetUserId]
  );
  const hasInspectionPass = exists(
    `SELECT 1 FROM inspections i
     JOIN applications a ON i.application_id = a.id
     WHERE a.business_id = ? AND i.pass = 1`,
    [targetUserId]
  );
  const hasCertificate = exists(
    `SELECT 1 FROM certificates c
     JOIN applications a ON c.application_id = a.id
     WHERE a.business_id = ?`,
    [targetUserId]
  );

  res.json({
    register: !!hasBusiness,
    apply: !!hasApplication,
    pay: !!hasReceipt,
    schedule: !!hasSchedule,
    inspect: !!hasInspectionPass,
    certify: !!hasCertificate,
    verify: !!hasCertificate, // verification is always possible when a certificate exists
    rightToCheck: !!hasCertificate,
  });
};

/**
 * POST /api/admin/demo/issue-no-payment
 * Attempts to issue a certificate without a payment. Expected to hit fee‑gate (409).
 */
export const adminIssueNoPayment = async (req: Request, res: Response) => {
  // Find a demo business that has an application but no receipt
  const appRow = db
    .prepare(
      `SELECT a.id as appId, b.id as businessId FROM applications a
       JOIN businesses b ON a.business_id = b.id
       WHERE NOT EXISTS (SELECT 1 FROM receipts r WHERE r.application_id = a.id)
       LIMIT 1`
    )
    .get() as { appId: string; businessId: string } | undefined;
  if (!appRow) {
    return res.status(400).json({ error: 'No suitable demo application without payment found' });
  }

  try {
    // This will throw because fee‑gate will fail (no receipt)
    await certificateService.issueCertificate(appRow.appId, 'demo-admin');
    return res.json({ success: true, message: 'Unexpectedly issued' });
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    const status = typeof err.statusCode === 'number' ? err.statusCode : 409;
    const message = err.message ?? 'Fee gate blocked issuance';
    return res.status(status).json({ error: message, code: 'GATE_BLOCKED' });
  }
};

/**
 * POST /api/admin/demo/tamper
 * Tamper a certificate's public_record to break the seal.
 * Body: { publicId }
 */
export const adminTamperCertificate = (req: Request, res: Response) => {
  const { publicId } = req.body as { publicId?: string };
  const targetId = publicId || 'sample-cert-val1d-0000';

  const cert = db.prepare('SELECT id, public_record FROM certificates WHERE public_id = ?').get(targetId) as { id: string; public_record: string } | undefined;
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  // Simple tamper: append a bogus field to the JSON record
  let publicRecord: Record<string, unknown>;
  try {
    publicRecord = JSON.parse(cert.public_record) as Record<string, unknown>;
  } catch {
    return res.status(500).json({ error: 'Corrupt public_record' });
  }
  const original = cert.public_record;
  publicRecord.tampered = true;
  const tampered = JSON.stringify(publicRecord);

  // Store original for undo in a temporary table
  db.prepare('CREATE TABLE IF NOT EXISTS certificate_tamper_backup (cert_id TEXT, original_record TEXT)').run();
  const existing = db.prepare('SELECT 1 FROM certificate_tamper_backup WHERE cert_id = ?').get(cert.id);
  if (!existing) {
    db.prepare('INSERT INTO certificate_tamper_backup (cert_id, original_record) VALUES (?, ?)').run(cert.id, original);
  }

  db.prepare('UPDATE certificates SET public_record = ? WHERE id = ?').run(tampered, cert.id);

  res.json({ success: true, publicId: targetId, message: 'Certificate tampered. Verification will now report "Seal broken".' });
};

/**
 * POST /api/admin/demo/undo-tamper
 * Restores a tampered certificate's original public_record.
 * Body: { publicId }
 */
export const adminUndoTamperCertificate = (req: Request, res: Response) => {
  const { publicId } = req.body as { publicId?: string };
  const targetId = publicId || 'sample-cert-val1d-0000';

  const cert = db.prepare('SELECT id FROM certificates WHERE public_id = ?').get(targetId) as { id: string } | undefined;
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  db.prepare('CREATE TABLE IF NOT EXISTS certificate_tamper_backup (cert_id TEXT, original_record TEXT)').run();
  const backup = db.prepare('SELECT original_record FROM certificate_tamper_backup WHERE cert_id = ? ORDER BY rowid DESC LIMIT 1').get(cert.id) as { original_record: string } | undefined;
  if (!backup) {
    return res.status(400).json({ error: 'No tamper backup found for this certificate' });
  }

  db.prepare('UPDATE certificates SET public_record = ? WHERE id = ?').run(backup.original_record, cert.id);
  db.prepare('DELETE FROM certificate_tamper_backup WHERE cert_id = ?').run(cert.id);

  res.json({ success: true, publicId: targetId, message: 'Certificate restored. Seal is valid again.' });
};

/**
 * GET /api/admin/demo/tamper-status
 * Checks if a certificate is currently tampered.
 */
export const getTamperStatus = (req: Request, res: Response) => {
  const publicId = (req.query.publicId as string) || 'sample-cert-val1d-0000';
  const cert = db.prepare('SELECT id FROM certificates WHERE public_id = ?').get(publicId) as { id: string } | undefined;
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found' });
  }
  db.prepare('CREATE TABLE IF NOT EXISTS certificate_tamper_backup (cert_id TEXT, original_record TEXT)').run();
  const backup = db.prepare('SELECT 1 FROM certificate_tamper_backup WHERE cert_id = ?').get(cert.id);
  res.json({ publicId, isTampered: !!backup });
};

/**
 * POST /api/admin/demo/reset
 * Runs the demo seed script to reset all demo data.
 */
export const adminResetDemo = (req: Request, res: Response) => {
  try {
    // Use npm script defined in package.json (demo:reset) – synchronous for simplicity
    execSync('npm run demo:reset', { stdio: 'ignore' });
    res.json({ success: true, message: 'Demo data reset' });
  } catch {
    res.status(500).json({ error: 'Failed to reset demo data' });
  }
};

/**
 * POST /api/demo/login-as/:role
 * Generates a JWT for the first seeded user of the given role.
 */
export const demoLoginAs = (req: Request, res: Response) => {
  // Demo login is only available when DEMO_MODE is enabled
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({ error: 'Demo mode disabled' });
  }
  const role = (req.params.role || '').toUpperCase();
  const user = db.prepare('SELECT id, email, role, name FROM users WHERE UPPER(role) = ? LIMIT 1').get(role) as { id: string; email: string; role: string; name: string } | undefined;
  if (!user) {
    return res.status(404).json({ error: 'No demo user found for this role' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    jwtSecret(),
    { expiresIn: '1d' }
  );
  const isSecure = process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });
  // Respond with the user object directly (contains role and name fields)
  res.json({ id: user.id, email: user.email, role: user.role, name: user.name });
};

// Export routes for registration in app.ts
export const demoRoutes = [
  { method: 'GET', path: '/api/demo/progress', handler: [getDemoProgress] },
  { method: 'POST', path: '/api/demo/login-as/:role', handler: [demoLoginAs] },
  { method: 'POST', path: '/api/admin/demo/issue-no-payment', handler: [adminIssueNoPayment] },
  { method: 'POST', path: '/api/admin/demo/tamper', handler: [adminTamperCertificate] },
  { method: 'POST', path: '/api/admin/demo/undo-tamper', handler: [adminUndoTamperCertificate] },
  { method: 'GET', path: '/api/admin/demo/tamper-status', handler: [getTamperStatus] },
  { method: 'POST', path: '/api/admin/demo/reset', handler: [adminResetDemo] },
];
