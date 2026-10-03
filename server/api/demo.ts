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
  if (!user || user.role !== 'BUSINESS') {
    return res.status(403).json({ error: 'Business role required' });
  }

  // Helper to check existence of a query result
  const exists = (sql: string, params?: (string | number)[]) => !!db.prepare(sql).get(...(params || []));

  const hasBusiness = exists('SELECT 1 FROM businesses WHERE owner_id = ?', [user.id]);
  const hasApplication = exists('SELECT 1 FROM applications WHERE business_id = ?', [user.id]);
  const hasReceipt = exists(
    `SELECT 1 FROM receipts r
     JOIN applications a ON r.application_id = a.id
     WHERE a.business_id = ?`,
    [user.id]
  );
  const hasSchedule = exists(
    `SELECT 1 FROM appointments ap
     JOIN applications a ON ap.application_id = a.id
     WHERE a.business_id = ?`,
    [user.id]
  );
  const hasInspectionPass = exists(
    `SELECT 1 FROM inspections i
     JOIN applications a ON i.application_id = a.id
     WHERE a.business_id = ? AND i.pass = 1`,
    [user.id]
  );
  const hasCertificate = exists(
    `SELECT 1 FROM certificates c
     JOIN applications a ON c.application_id = a.id
     WHERE a.business_id = ?`,
    [user.id]
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
    return res.status(status).json({ error: message });
  }
};

/**
 * POST /api/admin/demo/tamper
 * Tamper a certificate's public_record to break the seal.
 * Body: { publicId }
 */
export const adminTamperCertificate = (req: Request, res: Response) => {
  const { publicId } = req.body as { publicId?: string };
  if (!publicId) {
    return res.status(400).json({ error: 'publicId required' });
  }

  const cert = db.prepare('SELECT id, public_record FROM certificates WHERE public_id = ?').get(publicId) as { id: string; public_record: string } | undefined;
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
  const original = JSON.stringify(publicRecord);
  publicRecord.tampered = true;
  const tampered = JSON.stringify(publicRecord);

  // Store original for undo in a temporary table
  db.prepare('CREATE TABLE IF NOT EXISTS certificate_tamper_backup (cert_id INTEGER, original_record TEXT)').run();
  db.prepare('INSERT INTO certificate_tamper_backup (cert_id, original_record) VALUES (?, ?)').run(cert.id, original);

  db.prepare('UPDATE certificates SET public_record = ? WHERE id = ?').run(tampered, cert.id);

  res.json({ success: true, message: 'Certificate tampered. Verification will now report "Seal broken".' });
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
  const role = req.params.role;
  const user = db.prepare('SELECT id, email, role FROM users WHERE role = ? LIMIT 1').get(role) as { id: string; email: string; role: string } | undefined;
  if (!user) {
    return res.status(404).json({ error: 'No demo user found for this role' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    jwtSecret(),
    { expiresIn: '1d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  });
  res.json({ user });
};

// Export routes for registration in app.ts
export const demoRoutes = [
  { method: 'GET', path: '/api/demo/progress', handler: [getDemoProgress] },
  { method: 'POST', path: '/api/demo/login-as/:role', handler: [demoLoginAs] },
  { method: 'POST', path: '/api/admin/demo/issue-no-payment', handler: [adminIssueNoPayment] },
  { method: 'POST', path: '/api/admin/demo/tamper', handler: [adminTamperCertificate] },
  { method: 'POST', path: '/api/admin/demo/reset', handler: [adminResetDemo] },
];
