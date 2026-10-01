import bcrypt from 'bcryptjs';
import { db, transaction } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';
import { ensureKeys, buildDetailsDigest, signHash } from '../seal/index.js';
import crypto from 'node:crypto';

export function seedDemoData() {
  const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number};
  if (usersCount.c > 0) return; // already seeded

  const { privateKey } = ensureKeys();

  const pwHash = bcrypt.hashSync('demo123', 10);
  
  transaction(() => {
    // 1 admin, 2 LMOs, 1 GATC
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-ADMIN', 'admin@nishchay.gov.in', pwHash, 'ADMIN', 'Admin User', null);
      
    db.prepare('INSERT INTO zones (id, code, name) VALUES (?, ?, ?)')
      .run('ZONE-1', 'Z-DL-01', 'Delhi North');
    db.prepare('INSERT INTO zones (id, code, name) VALUES (?, ?, ?)')
      .run('ZONE-2', 'Z-DL-02', 'Delhi South');

    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-LMO1', 'lmo1@nishchay.gov.in', pwHash, 'LMO', 'LMO North', 'ZONE-1');
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-LMO2', 'lmo2@nishchay.gov.in', pwHash, 'LMO', 'LMO South', 'ZONE-2');
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-GATC1', 'gatc1@nishchay.gov.in', pwHash, 'GATC', 'GATC Central', null);
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-GATC2', 'gatc2@nishchay.gov.in', pwHash, 'GATC', 'GATC West', null);

    // 3 businesses
    const b1 = 'BIZ-1';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ1', 'biz1@example.com', pwHash, 'BUSINESS', 'Biz One Owner');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(b1, 'USR-BIZ1', 'Biz One', '123 Market', 'ZONE-1');

    const b2 = 'BIZ-2';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ2', 'biz2@example.com', pwHash, 'BUSINESS', 'Biz Two Owner');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(b2, 'USR-BIZ2', 'Biz Two', '456 Street', 'ZONE-2');
      
    const b3 = 'BIZ-3';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ3', 'biz3@example.com', pwHash, 'BUSINESS', 'Biz Three Owner');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(b3, 'USR-BIZ3', 'Biz Three (NAWI)', '789 Road', 'ZONE-1');

    // NAWI routed to GATC
    const i1 = generateId.instrument(1);
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?)')
      .run(i1, b3, 'NAWI-3', 'WeighCorp', 'M-100', '150kg');

    db.prepare("INSERT INTO counters (id, val) VALUES ('instrument', 1)").run();

    // Historical sealed certificate
    const app1 = generateId.application(2025, 1);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app1, b3, i1, 'CERTIFIED', 500, 'Routed to GATC');
    
    db.prepare("INSERT INTO counters (id, val) VALUES ('application-2025', 1)").run();
      
    const rec1 = generateId.receipt(2025, 1);
    const pay1 = 'PAY-1';
    db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
      .run(pay1, app1, 'idem1', 500, 'PAID');
      
    const paidTime = new Date().toISOString();
    const payload = `${rec1}:${app1}:${i1}:500:${paidTime}`;
    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(payload);
    const receiptSignature = hmac.digest('hex');

    db.prepare('INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(rec1, app1, pay1, 500, receiptSignature, paidTime);

    const certId = generateId.certificate(2025, 1);
    const details = {
      businessName: 'Biz Three (NAWI)',
      instrumentMake: 'WeighCorp',
      instrumentModel: 'M-100'
    };
    const sealHash = buildDetailsDigest(details);
    const signature = signHash(sealHash, privateKey);
    
    db.prepare('INSERT INTO certificates (id, application_id, receipt_id, valid_from, valid_to, seal_hash, seal_signature, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(certId, app1, rec1, '2025-01-01T00:00:00Z', '2026-01-01T00:00:00Z', sealHash, signature, 'VALID');

    // Create an application at INSPECTED_PASS state ready for gate test
    const app2 = generateId.application(2025, 2);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app2, b3, i1, 'INSPECTED_PASS', 500, 'Routed to GATC');
    
    const rec2 = generateId.receipt(2025, 2);
    const pay2 = 'PAY-2';
    db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
      .run(pay2, app2, 'idem2', 500, 'PAID');
      
    const payload2 = `${rec2}:${app2}:${i1}:500:${paidTime}`;
    const hmac2 = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac2.update(payload2);
    const receiptSignature2 = hmac2.digest('hex');

    db.prepare('INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(rec2, app2, pay2, 500, receiptSignature2, paidTime);

    // Create a SCHEDULED application for USR-LMO1
    const app4 = generateId.application(2025, 4);
    // Use an existing business and instrument (b2 is LMO-routed typically, wait b2 is there? b1 is b3 is there. Let's just create one)
    const b4 = 'BIZ-LMO-TEST';
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, type, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(b4, 'USR-BIZ1', 'Demo Field Business', 'Demo Field Address', 'DEALER', 'ZONE-1');
    const i4 = generateId.instrument(4);
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?)')
      .run(i4, b4, 'W-1', 'WeighCorp', 'M-100', '10kg');
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app4, b4, i4, 'ACCEPTED', 300, 'Routed to LMO');
    db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run('APT-1', app4, 'USR-LMO1', '2026-10-10', 'Morning', 'SCHEDULED');
      
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  // if run directly
  seedDemoData();
}
