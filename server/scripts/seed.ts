import bcrypt from 'bcryptjs';
import { db, transaction } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';
import { ensureKeys, buildDetailsDigest, signHash } from '../seal/index.js';

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
      .run(i1, b3, 'NAWI-III', 'WeighCorp', 'M-100', '150kg');

    db.prepare("INSERT INTO counters (id, val) VALUES ('instrument', 1)").run();

    // Historical sealed certificate
    const app1 = generateId.application(2025, 1);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state) VALUES (?, ?, ?, ?)')
      .run(app1, b3, i1, 'CERTIFIED');
    
    db.prepare("INSERT INTO counters (id, val) VALUES ('application-2025', 1)").run();
      
    const rec1 = generateId.receipt(2025, 1);
    const pay1 = 'PAY-1';
    db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
      .run(pay1, app1, 'idem1', 500, 'SUCCESS');
    db.prepare('INSERT INTO receipts (id, application_id, payment_id) VALUES (?, ?, ?)')
      .run(rec1, app1, pay1);

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

  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  // if run directly
  seedDemoData();
}
