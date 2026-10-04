import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { checkFeeGate } from '../services/paymentsService.js';
import crypto from 'node:crypto';
import { hmacSecret } from '../config/secrets.js';

describe('Fee-Gate Branch Coverage', () => {
  beforeAll(() => {
    runMigrations();
    db.prepare("INSERT OR IGNORE INTO zones (id, code, name) VALUES ('ZONE-FEE', 'ZN-FEE', 'Fee Test Zone')").run();
    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, role, name) VALUES ('USR-FEE', 'fee@test.example', 'hash', 'BUSINESS', 'Fee Owner')").run();
    db.prepare("INSERT OR IGNORE INTO businesses (id, owner_id, name, address, zone_id) VALUES ('BIZ-FEE', 'USR-FEE', 'Fee Biz', 'Addr', 'ZONE-FEE')").run();
    db.prepare("INSERT OR IGNORE INTO instruments (id, business_id, type_code, make, model, serial, capacity) VALUES ('INST-FEE', 'BIZ-FEE', 'W-1', 'Make', 'Mod', 'SN-FEE', '10kg')").run();
  });

  function createTestApp(appId: string) {
    db.prepare("INSERT OR REPLACE INTO applications (id, business_id, instrument_id, fee_amount, state) VALUES (?, 'BIZ-FEE', 'INST-FEE', 500, 'INSPECTED_PASS')").run(appId);
  }

  it('fee-gate branch: zero payments fails with Not exactly one PAID payment', () => {
    const appId = `APP-ZERO-${Date.now()}`;
    createTestApp(appId);

    const res = checkFeeGate(appId, 'USR-TEST');
    expect(res).toBe(false);

    const audit = db.prepare("SELECT * FROM audit_log WHERE record_id = ? AND action = 'GATE_BLOCKED' ORDER BY rowid DESC LIMIT 1").get(appId) as { new_data: string };
    expect(audit).toBeDefined();
    expect(JSON.parse(audit.new_data).reason).toBe('Not exactly one PAID payment');
  });

  it('fee-gate branch: two payments fails with Not exactly one PAID payment', () => {
    const appId = `APP-TWO-${Date.now()}`;
    createTestApp(appId);
    
    // Temporarily drop partial unique index to test defensive code against multiple payments
    db.prepare("DROP INDEX IF EXISTS idx_payments_paid_app").run();
    try {
      db.prepare("INSERT INTO payments (id, application_id, amount, status, idempotency_key) VALUES (?, ?, 500, 'PAID', ?)").run(`PAY-1-${appId}`, appId, `k1-${appId}`);
      db.prepare("INSERT INTO payments (id, application_id, amount, status, idempotency_key) VALUES (?, ?, 500, 'PAID', ?)").run(`PAY-2-${appId}`, appId, `k2-${appId}`);

      const res = checkFeeGate(appId, 'USR-TEST');
      expect(res).toBe(false);

      const audit = db.prepare("SELECT * FROM audit_log WHERE record_id = ? AND action = 'GATE_BLOCKED' ORDER BY rowid DESC LIMIT 1").get(appId) as { new_data: string };
      expect(audit).toBeDefined();
      expect(JSON.parse(audit.new_data).reason).toBe('Not exactly one PAID payment');
    } finally {
      // Clean up duplicate and recreate index
      db.prepare("DELETE FROM payments WHERE application_id = ?").run(appId);
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paid_app ON payments(application_id) WHERE status = 'PAID'").run();
    }
  });

  it('fee-gate branch: amount mismatch fails with Receipt amount mismatch', () => {
    const appId = `APP-MISMATCH-${Date.now()}`;
    createTestApp(appId);
    db.prepare("INSERT INTO payments (id, application_id, amount, status, idempotency_key) VALUES (?, ?, 500, 'PAID', ?)").run(`PAY-${appId}`, appId, `k-${appId}`);
    
    // Receipt with different amount (400 vs 500)
    const createdAt = new Date().toISOString();
    const payload = `REC-${appId}:${appId}:INST-FEE:400:${createdAt}`;
    const hmac = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('hex');
    db.prepare("INSERT INTO receipts (id, payment_id, application_id, amount, signature, created_at) VALUES (?, ?, ?, 400, ?, ?)").run(`REC-${appId}`, `PAY-${appId}`, appId, hmac, createdAt);

    const res = checkFeeGate(appId, 'USR-TEST');
    expect(res).toBe(false);

    const audit = db.prepare("SELECT * FROM audit_log WHERE record_id = ? AND action = 'GATE_BLOCKED' ORDER BY rowid DESC LIMIT 1").get(appId) as { new_data: string };
    expect(audit).toBeDefined();
    expect(JSON.parse(audit.new_data).reason).toBe('Receipt amount mismatch');
  });

  it('fee-gate branch: bad receipt signature fails with Receipt signature invalid', () => {
    const appId = `APP-BADSIG-${Date.now()}`;
    createTestApp(appId);
    db.prepare("INSERT INTO payments (id, application_id, amount, status, idempotency_key) VALUES (?, ?, 500, 'PAID', ?)").run(`PAY-${appId}`, appId, `k-${appId}`);
    
    const createdAt = new Date().toISOString();
    db.prepare("INSERT INTO receipts (id, payment_id, application_id, amount, signature, created_at) VALUES (?, ?, ?, 500, 'invalid-signature-hex', ?)").run(`REC-${appId}`, `PAY-${appId}`, appId, createdAt);

    const res = checkFeeGate(appId, 'USR-TEST');
    expect(res).toBe(false);

    const audit = db.prepare("SELECT * FROM audit_log WHERE record_id = ? AND action = 'GATE_BLOCKED' ORDER BY rowid DESC LIMIT 1").get(appId) as { new_data: string };
    expect(audit).toBeDefined();
    expect(JSON.parse(audit.new_data).reason).toBe('Receipt signature invalid');
  });

  it('fee-gate branch: receipt already used fails with Receipt already used', () => {
    const appId = `APP-USED-${Date.now()}`;
    createTestApp(appId);
    db.prepare("INSERT INTO payments (id, application_id, amount, status, idempotency_key) VALUES (?, ?, 500, 'PAID', ?)").run(`PAY-${appId}`, appId, `k-${appId}`);
    
    const createdAt = new Date().toISOString();
    const payload = `REC-${appId}:${appId}:INST-FEE:500:${createdAt}`;
    const hmac = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('hex');
    db.prepare("INSERT INTO receipts (id, payment_id, application_id, amount, signature, created_at) VALUES (?, ?, ?, 500, ?, ?)").run(`REC-${appId}`, `PAY-${appId}`, appId, hmac, createdAt);

    // Link receipt to an existing certificate
    db.prepare(`INSERT INTO certificates (public_id, application_id, instrument_id, receipt_id, public_record, hash, signature, key_id, valid_from, valid_to, status, details_digest, created_at)
      VALUES (?, ?, 'INST-FEE', ?, '{}', 'hash', 'sig', 'key', '2026-01-01', '2027-01-01', 'VALID', 'dig', CURRENT_TIMESTAMP)`).run(`CERT-${appId}`, appId, `REC-${appId}`);

    const res = checkFeeGate(appId, 'USR-TEST');
    expect(res).toBe(false);

    const audit = db.prepare("SELECT * FROM audit_log WHERE record_id = ? AND action = 'GATE_BLOCKED' ORDER BY rowid DESC LIMIT 1").get(appId) as { new_data: string };
    expect(audit).toBeDefined();
    expect(JSON.parse(audit.new_data).reason).toBe('Receipt already used');
  });
});
