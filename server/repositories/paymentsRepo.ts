import { db, nextSequence } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';
import crypto from 'node:crypto';

export function getPaymentByIdempotencyKey(key: string) {
  return db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(key) as Record<string, unknown> | undefined;
}

export function createPayment(applicationId: string, amount: number, key: string) {
  const id = 'pay_' + crypto.randomBytes(12).toString('hex');
  db.prepare(`
    INSERT INTO payments (id, application_id, idempotency_key, amount, status)
    VALUES (?, ?, ?, ?, 'PENDING')
  `).run(id, applicationId, key, amount);
  return id;
}

export function getPaymentById(id: string) {
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
}

export function processPaymentSuccess(paymentId: string, applicationId: string, instrumentId: string, amount: number, userId: string) {
  // Update payment status
  db.prepare('UPDATE payments SET status = ? WHERE id = ?').run('PAID', paymentId);
  
  // Create receipt
  const seq = nextSequence('receipt');
  const receiptId = generateId.receipt(new Date().getFullYear(), seq);
  
  const paidTime = new Date().toISOString();
  
  // HMAC-sign receipt
  // (receipt number, application id, instrument id, amount, paid time)
  const payload = `${receiptId}:${applicationId}:${instrumentId}:${amount}:${paidTime}`;
  const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  db.prepare(`
    INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(receiptId, applicationId, paymentId, amount, signature, paidTime);
  
  // Audit log
  db.prepare(`
    INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
    VALUES (hex(randomblob(16)), 'applications', ?, 'UPDATE', ?, ?)
  `).run(applicationId, userId, JSON.stringify({ state: 'PAID', payment_id: paymentId, receipt_id: receiptId }));

  return receiptId;
}

export function processPaymentFailure(paymentId: string) {
  db.prepare('UPDATE payments SET status = ? WHERE id = ?').run('FAILED', paymentId);
}

export function getReceiptByApplication(appId: string) {
  return db.prepare('SELECT * FROM receipts WHERE application_id = ?').get(appId) as Record<string, unknown> | undefined;
}

export function getAllPayments() {
  return db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all();
}

export function getAllReceipts() {
  return db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all();
}

export function getGateBlocksCount() {
  return db.prepare("SELECT count(*) as count FROM audit_log WHERE action = 'GATE_BLOCKED'").get() as { count: number };
}

export function recordGateBlock(applicationId: string, userId: string, reason: string) {
  db.prepare(`
    INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
    VALUES (hex(randomblob(16)), 'applications', ?, 'GATE_BLOCKED', ?, ?)
  `).run(applicationId, userId, JSON.stringify({ reason }));
}
