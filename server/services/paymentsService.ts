import { transaction, db } from '../db/index.js';
import { createPayment, getPaymentById, processPaymentSuccess, processPaymentFailure, getReceiptByApplication, recordGateBlock, recordDemoTool } from '../repositories/paymentsRepo.js';
import { findApplicationById } from '../repositories/applicationsRepo.js';
import { getBusinessByOwner } from '../repositories/instrumentsRepo.js';
import { transition, State } from '../../shared/src/stateMachine.js';
import { clock } from '../../shared/src/clock.js';
import crypto from 'node:crypto';
import { hmacSecret } from '../config/secrets.js';

export function initiatePaymentService(user: Express.Request['user'], applicationId: string, amount: number) {
  if (!user || user.role !== 'BUSINESS') throw new Error('Forbidden');
  
  const app = findApplicationById(applicationId);
  if (!app) throw new Error('Application not found');
  if (app.state !== 'SUBMITTED') throw new Error('Application must be in SUBMITTED state');
  if (app.fee_amount !== amount) throw new Error('Amount must equal fee snapshot');
  
  // Create idempotency key based on attempt timestamp to allow retries on failure
  const idempKey = 'pay_' + applicationId + '_' + Date.now().toString();
  return transaction(() => {
    const paymentId = createPayment(applicationId, amount, idempKey);
    return { paymentId, idempotencyKey: idempKey };
  });
}

export function settlePayment(
  body: { paymentId: string, status: 'SUCCESS' | 'FAILURE' | 'PENDING', amount: number, timestamp: number, applicationId: string }
) {
  return transaction(() => {
    const payment = getPaymentById(body.paymentId);
    if (!payment) throw new Error('Payment not found');
    
    // Idempotency check: replay of same key returns original result
    if (payment.status === 'PAID' || payment.status === 'FAILED') {
      return { status: payment.status };
    }
    
    if (payment.amount !== body.amount) throw new Error('Amount mismatch');
    
    const app = findApplicationById(body.applicationId);
    if (!app) throw new Error('Application not found');

    if (body.status === 'SUCCESS') {
      // Move application to PAID
      transition(app.state as State, { type: 'payment_succeeded' });
      db.prepare('UPDATE applications SET state = ? WHERE id = ?').run('PAID', app.id);

      
      const receiptId = processPaymentSuccess(
        payment.id as string, 
        app.id as string, 
        app.instrument_id as string, 
        app.fee_amount as number,
        'SYSTEM' // changed_by
      );
      
      return { status: 'PAID', receiptId };
    } else if (body.status === 'FAILURE') {
      processPaymentFailure(payment.id as string);
      return { status: 'FAILED' };
    }
    
    return { status: 'PENDING' };
  });
}

export function paymentCallbackService(
  body: { paymentId: string, status: 'SUCCESS' | 'FAILURE' | 'PENDING', amount: number, timestamp: number, applicationId: string },
  signature: string
) {
  // Verify signature
  const hmac = crypto.createHmac('sha256', hmacSecret());
  hmac.update(`${body.paymentId}:${body.status}:${body.amount}:${body.timestamp}:${body.applicationId}`);
  const expectedSig = hmac.digest('hex');
  
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSig, 'utf8'))) {
      throw new Error('Invalid signature');
    }
  } catch {
    throw new Error('Invalid signature');
  }

  // Check timestamp (within 15 minutes)
  const now = clock.now();
  if (Math.abs(now - body.timestamp) > 15 * 60 * 1000) {
    throw new Error('Timestamp expired');
  }

  return settlePayment(body);
}

export type DemoPayResult =
  | { ok: true; status: 'PAID'; receiptId: string }
  | { ok: false; httpStatus: 403 | 404 | 409; code: string; message: string };

export function demoPayService(user: Express.Request['user'], paymentId: string): DemoPayResult {
  if (!user || user.role !== 'BUSINESS') return { ok: false, httpStatus: 403, code: 'FORBIDDEN', message: 'Forbidden' };
  const payment = getPaymentById(paymentId);
  if (!payment) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'Payment not found' };
  const app = findApplicationById(payment.application_id as string);
  if (!app) return { ok: false, httpStatus: 404, code: 'NOT_FOUND', message: 'Application not found' };
  // Ownership check: same pattern as getApplicationService
  const biz = getBusinessByOwner(user.id);
  if (!biz || app.business_id !== biz.id) return { ok: false, httpStatus: 403, code: 'FORBIDDEN', message: 'Forbidden' };
  if (payment.status !== 'PENDING') return { ok: false, httpStatus: 409, code: 'CONFLICT', message: 'Payment is not pending' };
  if (app.state !== 'SUBMITTED') return { ok: false, httpStatus: 409, code: 'CONFLICT', message: 'Application is not awaiting payment' };
  const result = settlePayment({ paymentId, status: 'SUCCESS', amount: payment.amount as number, timestamp: clock.now(), applicationId: app.id as string });
  recordDemoTool(app.id as string, user.id, { action: 'demo_pay', paymentId });
  return { ok: true, status: 'PAID', receiptId: (result as { receiptId: string }).receiptId };
}

export function checkFeeGate(applicationId: string, userId: string = 'SYSTEM') {
  return transaction(() => {
    const app = findApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    
    const fail = (reason: string) => {
      recordGateBlock(applicationId, userId, reason);
      return false;
    };
    
    if (app.state !== 'INSPECTED_PASS') {
      return fail('State not INSPECTED_PASS');
    }
    
    // Exactly one PAID payment
    const paidPayments = db.prepare("SELECT * FROM payments WHERE application_id = ? AND status = 'PAID'").all(applicationId);
    if (paidPayments.length !== 1) {
      return fail('Not exactly one PAID payment');
    }
    
    const receipt = getReceiptByApplication(applicationId);
    if (!receipt) {
      return fail('Receipt not found');
    }
    
    // Receipt amount equals fee snapshot
    if (receipt.amount !== app.fee_amount) {
      return fail('Receipt amount mismatch');
    }
    
    // Receipt HMAC valid
    const payload = `${receipt.id}:${applicationId}:${app.instrument_id}:${receipt.amount}:${receipt.created_at}`;
    const hmac = crypto.createHmac('sha256', hmacSecret());
    hmac.update(payload);
    if (hmac.digest('hex') !== receipt.signature) {
      return fail('Receipt signature invalid');
    }
    
    // Not linked to another certificate
    const cert = db.prepare('SELECT id FROM certificates WHERE receipt_id = ?').get(receipt.id);
    if (cert) {
      return fail('Receipt already used');
    }
    
    return true;
  });
}
