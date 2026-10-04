import bcrypt from 'bcryptjs';
import { db, transaction } from '../db/index.js';
import { canonicalJson } from '../../shared/src/canonicalJson.js';
import { generateId, DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED } from '../../shared/src/ids.js';
import { ensureKeys, signHash } from '../seal/index.js';
export { DEMO_CERT_VALID, DEMO_CERT_EXPIRED, DEMO_CERT_REVOKED };
import crypto from 'node:crypto';
import { hmacSecret } from '../config/secrets.js';
import fs from 'node:fs';
import path from 'node:path';
import { clock } from '../../shared/src/clock.js';
import { storageDir } from '../config/paths.js';

export function seedDemoData() {
  const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (usersCount.c > 0) return; // already seeded

  db.exec("INSERT OR REPLACE INTO counters (id, val) VALUES ('INS', 12), ('APP', 12), ('CRT', 10), ('JOB', 10), ('PAY', 10), ('PHO', 10), ('USR', 10), ('application', 12), ('instrument', 12), ('receipt', 10)");

  const { privateKey, keyId } = ensureKeys();
  const pwHash = bcrypt.hashSync('demo123', 10);
  
  transaction(() => {
    // 1 Admin
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-ADMIN', 'admin@nishchay.example', pwHash, 'ADMIN', 'Admin User', null);
      
    // Named Zones: Hyderabad North and Hyderabad South
    db.prepare('INSERT INTO zones (id, code, name) VALUES (?, ?, ?)')
      .run('ZONE-1', 'Z-HYD-01', 'Hyderabad North');
    db.prepare('INSERT INTO zones (id, code, name) VALUES (?, ?, ?)')
      .run('ZONE-2', 'Z-HYD-02', 'Hyderabad South');

    // Officers with real-sounding names: 2 LMOs and 1 GATC (daily capacity 8 with centre name)
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id, daily_capacity) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('USR-LMO1', 'lmo1@nishchay.example', pwHash, 'LMO', 'Rajesh Sharma', 'ZONE-1', 12);
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id, daily_capacity) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('USR-LMO2', 'lmo2@nishchay.example', pwHash, 'LMO', 'Sunita Reddy', 'ZONE-2', 12);
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id, daily_capacity, gatc_centre_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('USR-GATC1', 'gatc1@nishchay.example', pwHash, 'GATC', 'Vikram Malhotra', null, 8, 'Deccan Legal Metrology Testing Centre');
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id, daily_capacity, gatc_centre_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('USR-GATC2', 'gatc2@nishchay.example', pwHash, 'GATC', 'Pooja Verma', null, 8, 'Telangana Metrology Testing Centre');

    // 6 Businesses with instruments in every class
    const b1 = 'BIZ-1';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ1', 'biz1@nishchay.example', pwHash, 'BUSINESS', 'Ramesh Rao');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id, gstin, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b1, 'USR-BIZ1', 'Biz One', 'Shop 12, Osmangunj Wholesale Market, Mozamjahi Market Road, Hyderabad 500012', 'ZONE-1', '36AAAAA0000A1Z5', 'RETAILER');

    const b2 = 'BIZ-2';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ2', 'biz2@nishchay.example', pwHash, 'BUSINESS', 'Suresh Kumar');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id, gstin, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b2, 'USR-BIZ2', 'Biz Two', 'Plot 45, Industrial Suburb, Nacharam, Hyderabad 500076', 'ZONE-2', '36BBBBB1111B1Z2', 'TRADER');
      
    const b3 = 'BIZ-3';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ3', 'biz3@nishchay.example', pwHash, 'BUSINESS', 'K. Venkat Reddy');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id, gstin, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b3, 'USR-BIZ3', 'Biz Three (NAWI)', 'G-4 Logistics Park, Shamshabad, Hyderabad 501218', 'ZONE-1', '36CCCCC2222C1Z9', 'MANUFACTURER');

    const b4 = 'BIZ-4';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ4', 'biz4@nishchay.example', pwHash, 'BUSINESS', 'Mohammed Ismail');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id, gstin, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b4, 'USR-BIZ4', 'Charminar Spices & Oils', '21-2-45 Lad Bazaar, Charminar, Hyderabad 500002', 'ZONE-2', '36DDDDD3333D1Z6', 'DEALER');

    const b5 = 'BIZ-5';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ5', 'biz5@nishchay.example', pwHash, 'BUSINESS', 'Ananya Sharma');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id, gstin, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b5, 'USR-BIZ5', 'Secunderabad Grain Wholesale', '14 RP Road, Secunderabad, Hyderabad 500003', 'ZONE-1', '36EEEEE4444E1Z3', 'WHOLESALER');

    const b6 = 'BIZ-6';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ6', 'biz6@nishchay.example', pwHash, 'BUSINESS', 'P. Srinivas');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id, gstin, type) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(b6, 'USR-BIZ6', 'Golconda Industrial Scales', 'B-12 Sanathnagar Industrial Estate, Hyderabad 500018', 'ZONE-1', '36FFFFF5555F1Z0', 'MANUFACTURER');

    // Instruments for BIZ-1 (Demo Business: exactly 1 certified, 1 application SCHEDULED, 1 with no application)
    const iValid = generateId.instrument(1); // W-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iValid, b1, 'W-1', 'National Standards Co', 'Brass Cylindrical M1', '10kg', 'WT-2026-0001', 'M1', 'Shop Floor Counter 1');

    const iScheduled = generateId.instrument(2); // L-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iScheduled, b1, 'L-1', 'Crown Steel Works', 'Precision Meter Rule', '1m', 'LM-2026-0112', 'Class II', 'Textile Section Counter 3');

    const iNoApp = generateId.instrument(3); // CM-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iNoApp, b1, 'CM-1', 'Avery India', 'Dial Counter Scale', '25kg', 'CS-2026-0341', 'Class III', 'Grain Packing Counter');

    // Instruments for BIZ-2
    const iExpired = generateId.instrument(4); // CM-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iExpired, b2, 'CM-1', 'Avery India', 'CounterScale-50', '50kg', 'CS-2025-0042', 'Class III', 'Main Yard Counter');

    const iPaid = generateId.instrument(5); // C-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iPaid, b2, 'C-1', 'Bharat Metal Works', 'Conical Measure 5L', '5L', 'CP-2026-0501', 'Standard', 'Oil Dispensing Station');

    // Instruments for BIZ-3
    const iRevoked = generateId.instrument(6); // NAWI-3
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iRevoked, b3, 'NAWI-3', 'WeighCorp', 'M-100', '150kg', 'NW-2026-0999', 'Class III', 'Cargo Bay 1');

    const iInspPass = generateId.instrument(7); // NAWI-3
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iInspPass, b3, 'NAWI-3', 'Eagle Digital', 'Platform-150', '150kg', 'NW-2026-0888', 'Class III', 'Cargo Bay 2');

    // Instruments for BIZ-4
    const iSubmitted = generateId.instrument(8); // C-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iSubmitted, b4, 'C-1', 'Standard Brass Works', 'Cylindrical 1L', '1L', 'CP-2026-0102', 'Standard', 'Retail Counter');

    const iDraft = generateId.instrument(9); // W-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iDraft, b4, 'W-1', 'National Standards', 'Cast Iron Hex 5kg', '5kg', 'WT-2026-0055', 'M2', 'Spice Grinding Station');

    // Instruments for BIZ-5
    const iAccepted = generateId.instrument(10); // CM-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iAccepted, b5, 'CM-1', 'Crown Weighing', 'Heavy Counter-20', '20kg', 'CS-2026-0777', 'Class III', 'Wholesale Counter A');

    const iFailed = generateId.instrument(11); // L-1
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iFailed, b5, 'L-1', 'Precision Rules India', 'Rigid Rule 2m', '2m', 'LM-2026-0205', 'Class II', 'Cutting Yard');

    // Instruments for BIZ-6
    const iCancelled = generateId.instrument(12); // NAWI-3
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(iCancelled, b6, 'NAWI-3', 'WeighCorp', 'Industrial 100', '100kg', 'NW-2026-0444', 'Class III', 'Assembly Line 1');

    const uploadDir = storageDir();

    const createFullCert = (
      appId: string,
      recId: string,
      payId: string,
      publicId: string,
      certificateNo: string,
      validFrom: string,
      validTo: string,
      status: string,
      bId: string,
      iId: string,
      fee: number,
      revokedAt: string | null = null,
      revokedReason: string | null = null
    ) => {
      const paidTime = validFrom;
      const photoName = `seal-photo-${publicId}.png`;
      const photoContent = `photo-data-for-${publicId}`;
      const photoHash = crypto.createHash('sha256').update(photoContent).digest('hex');
      fs.writeFileSync(path.join(uploadDir, photoName), Buffer.from(photoContent));

      const privateDetails = {
        officerId: 'USR-LMO1',
        gpsLat: 17.3850,
        gpsLng: 78.4867,
        distance: 12,
        checklist: ['Visual inspection intact', 'Verification scale verified', 'Zero balance verified'],
        readings: [{ applied: 10, observed: 10 }, { applied: 20, observed: 20 }],
        photos: [{ fileName: photoName, fileHash: photoHash }]
      };
      const detailsDigest = crypto.createHash('sha256').update(canonicalJson(privateDetails)).digest('hex');

      // Create Application
      db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
        .run(appId, bId, iId, 'CERTIFIED', fee, 'Routed to Authority');
      
      // Create Payment & Receipt
      db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
        .run(payId, appId, 'idem-' + recId, fee, 'PAID');
      
      const payload = `${recId}:${appId}:${iId}:${fee}:${paidTime}`;
      const hmac = crypto.createHmac('sha256', hmacSecret());
      hmac.update(payload);
      const receiptSignature = hmac.digest('hex');

      db.prepare('INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(recId, appId, payId, fee, receiptSignature, paidTime);

      // Audit Log for arrival record
      db.prepare(`
        INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data, timestamp)
        VALUES (hex(randomblob(16)), 'applications', ?, 'ARRIVED', 'USR-LMO1', 'Officer arrived on premises', CURRENT_TIMESTAMP)
      `).run(appId);

      // Create Inspection & Photo
      db.prepare('INSERT INTO inspections (id, application_id, officer_id, gps_lat, gps_lng, gps_distance, checklist, readings, pass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('INSP-' + appId, appId, 'USR-LMO1', 17.3850, 78.4867, 12, JSON.stringify(privateDetails.checklist), JSON.stringify(privateDetails.readings), 1);
      
      db.prepare('INSERT INTO inspection_photos (id, application_id, uploader_id, file_name, file_hash, client_capture_time, server_receive_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run('PHO-' + appId, appId, 'USR-LMO1', photoName, photoHash, paidTime, paidTime);

      // Public Record
      const bName = (db.prepare('SELECT name FROM businesses WHERE id = ?').get(bId) as { name: string }).name;
      const iData = db.prepare('SELECT type_code, serial FROM instruments WHERE id = ?').get(iId) as { type_code: string; serial: string };
      const publicRecord = {
        v: 1,
        certificateNo,
        instrumentId: iId,
        tradeName: bName,
        instrumentClass: iData.type_code,
        serialNo: iData.serial || iId,
        validFrom,
        validTo,
        authorityName: 'Legal Metrology Department, Telangana',
        receiptDigest: crypto.createHash('sha256').update(JSON.stringify({ id: recId, amount: fee })).digest('hex'),
        detailsDigest
      };

      const publicRecordStr = canonicalJson(publicRecord);
      const sealHash = crypto.createHash('sha256').update(publicRecordStr).digest('hex');
      const signature = signHash(sealHash, privateKey);
      
      db.prepare(`INSERT INTO certificates (public_id, application_id, instrument_id, receipt_id, valid_from, valid_to, hash, signature, key_id, public_record, details_digest, status, revoked_at, revoked_reason) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(publicId, appId, iId, recId, validFrom, validTo, sealHash, signature, keyId, publicRecordStr, detailsDigest, status, revokedAt, revokedReason);
    };

    const now = clock.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStr = new Date(now).toISOString().split('T')[0];
    const tomorrowStr = new Date(now + dayMs).toISOString().split('T')[0];

    // Helper for creating signed receipts and payments
    const createPaidApp = (appId: string, bId: string, iId: string, state: string, fee: number, payId: string, recId: string, rule: string, paidTime: string) => {
      db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
        .run(appId, bId, iId, state, fee, rule);

      db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
        .run(payId, appId, 'idem-' + recId, fee, 'PAID');

      const payload = `${recId}:${appId}:${iId}:${fee}:${paidTime}`;
      const hmac = crypto.createHmac('sha256', hmacSecret());
      hmac.update(payload);
      const receiptSignature = hmac.digest('hex');

      db.prepare('INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(recId, appId, payId, fee, receiptSignature, paidTime);

      db.prepare(`
        INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data, timestamp)
        VALUES (hex(randomblob(16)), 'payments', ?, 'PAYMENT_RECEIVED', 'SYSTEM', ?, ?)
      `).run(payId, JSON.stringify({ amount: fee, status: 'PAID' }), paidTime);
    };

    // 1. VALID Certificate: BIZ-1 (b1), weights (iValid), issued 2 months ago, valid 12 months
    const validIssued = new Date(now - 60 * dayMs).toISOString();
    const validValidTo = new Date(now + 305 * dayMs).toISOString();
    createFullCert(
      generateId.application(2025, 1),
      generateId.receipt(2025, 1),
      'PAY-1',
      DEMO_CERT_VALID,
      generateId.certificate(2025, 1),
      validIssued,
      validValidTo,
      'VALID',
      b1,
      iValid,
      100
    );

    // 2. EXPIRED Certificate: BIZ-2 (b2), counter machine (iExpired), issued 18 months ago, valid 12 months (expired 6 months ago)
    const expiredIssued = new Date(now - 18 * 30 * dayMs).toISOString();
    const expiredValidTo = new Date(now - 6 * 30 * dayMs).toISOString();
    createFullCert(
      generateId.application(2025, 3),
      generateId.receipt(2025, 3),
      'PAY-3',
      DEMO_CERT_EXPIRED,
      generateId.certificate(2025, 2),
      expiredIssued,
      expiredValidTo,
      'EXPIRED',
      b2,
      iExpired,
      200
    );

    // 3. REVOKED Certificate: BIZ-3 (b3), NAWI-3 (iRevoked), issued 2 months ago, revoked 3 weeks ago
    const revokedIssued = new Date(now - 60 * dayMs).toISOString();
    const revokedValidTo = new Date(now + 305 * dayMs).toISOString();
    const revokedAt = new Date(now - 21 * dayMs).toISOString();
    createFullCert(
      generateId.application(2025, 5),
      generateId.receipt(2025, 5),
      'PAY-5',
      DEMO_CERT_REVOKED,
      generateId.certificate(2025, 3),
      revokedIssued,
      revokedValidTo,
      'REVOKED',
      b3,
      iRevoked,
      500,
      revokedAt,
      'Surveillance re-audit detected load cell calibration drift beyond MPE'
    );

    // BIZ-1: Exactly one SCHEDULED application (with today's appointment for USR-LMO1) and receipt
    const app2Id = generateId.application(2026, 2);
    const rec2Id = generateId.receipt(2026, 2);
    createPaidApp(app2Id, b1, iScheduled, 'SCHEDULED', 100, 'PAY-2', rec2Id, 'Routed to LMO', new Date(now - 2 * dayMs).toISOString());
    db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run('APT-1', app2Id, 'USR-LMO1', todayStr, 'MORNING', 'SCHEDULED');
    db.prepare(`
      INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data, timestamp)
      VALUES (hex(randomblob(16)), 'appointments', ?, 'SCHEDULED', 'USR-BIZ1', ?, CURRENT_TIMESTAMP)
    `).run('APT-1', JSON.stringify({ slot_date: todayStr, slot_time: 'MORNING', officer: 'USR-LMO1' }));

    // BIZ-2: One PAID application awaiting scheduling
    const app4IdPaid = generateId.application(2026, 4);
    const rec4IdPaid = generateId.receipt(2026, 4);
    createPaidApp(app4IdPaid, b2, iPaid, 'PAID', 150, 'PAY-4', rec4IdPaid, 'Routed to LMO', new Date(now - 1 * dayMs).toISOString());

    // BIZ-3: One INSPECTED_PASS application (kept as NSH-A-2025-000004 for block9.test.ts)
    const app4 = generateId.application(2025, 4);
    const rec4 = generateId.receipt(2025, 4);
    createPaidApp(app4, b3, iInspPass, 'INSPECTED_PASS', 500, 'PAY-6', rec4, 'Routed to GATC', new Date(now - 3 * dayMs).toISOString());
    db.prepare('INSERT INTO inspections (id, application_id, officer_id, gps_lat, gps_lng, gps_distance, checklist, readings, pass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('INSP-' + app4, app4, 'USR-GATC1', 17.3850, 78.4867, 10, JSON.stringify(['Zero tracking functional', 'Display readable', 'Level intact']), JSON.stringify([{ applied: 50, observed: 50 }, { applied: 100, observed: 100 }]), 1);

    // BIZ-4: One SUBMITTED application and one DRAFT application
    const app7Id = generateId.application(2026, 7);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app7Id, b4, iSubmitted, 'SUBMITTED', 150, 'Routed to LMO');

    const app8Id = generateId.application(2026, 8);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app8Id, b4, iDraft, 'DRAFT', 100, 'Routed to LMO');

    // BIZ-5: One ACCEPTED application (appointment tomorrow) and one FAILED application
    const app9Id = generateId.application(2026, 9);
    const rec7Id = generateId.receipt(2026, 7);
    createPaidApp(app9Id, b5, iAccepted, 'ACCEPTED', 200, 'PAY-7', rec7Id, 'Routed to LMO', new Date(now - 4 * dayMs).toISOString());
    db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run('APT-2', app9Id, 'USR-LMO1', tomorrowStr, 'AFTERNOON', 'ACCEPTED');

    const app10Id = generateId.application(2026, 10);
    const rec8Id = generateId.receipt(2026, 8);
    createPaidApp(app10Id, b5, iFailed, 'FAILED', 100, 'PAY-8', rec8Id, 'Routed to LMO', new Date(now - 5 * dayMs).toISOString());
    db.prepare('INSERT INTO inspections (id, application_id, officer_id, gps_lat, gps_lng, gps_distance, checklist, readings, pass, reasons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('INSP-' + app10Id, app10Id, 'USR-LMO1', 17.3850, 78.4867, 15, JSON.stringify(['Visual check']), JSON.stringify([{ applied: 10, observed: 12 }]), 0, JSON.stringify(['Graduation lines worn beyond maximum permissible error']));

    // BIZ-6: One CANCELLED application
    const app11Id = generateId.application(2026, 11);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app11Id, b6, iCancelled, 'CANCELLED', 500, 'Routed to GATC');

    // Three complaints of both categories in certificate_complaints
    db.prepare('INSERT INTO certificate_complaints (public_id, note, category, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run(DEMO_CERT_VALID, 'Lead verification seal appears severed at the base.', 'Report suspected tampering');
    db.prepare('INSERT INTO certificate_complaints (public_id, note, category, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run(DEMO_CERT_EXPIRED, 'Counter scale operating with expired verification certificate in retail shop.', 'Expired stamp in use');
    db.prepare('INSERT INTO certificate_complaints (public_id, note, category, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
      .run(DEMO_CERT_VALID, 'Merchant refused to produce standard test weights upon consumer inquiry.', 'Test weights not available on request');

    // Sync counters for everything using shared/src/ids.ts format
    const updateCounter = (key: string, val: number) => {
      const current = (db.prepare('SELECT val FROM counters WHERE id = ?').get(key) as { val: number })?.val || 0;
      if (val > current) {
        db.prepare('INSERT OR REPLACE INTO counters (id, val) VALUES (?, ?)').run(key, val);
      }
    };

    const getMaxSeq = (ids: string[]) => Math.max(0, ...ids.map(id => parseInt(id.split('-').pop() || '0', 10)));
    
    updateCounter('instrument', getMaxSeq((db.prepare('SELECT id FROM instruments').all() as { id: string }[]).map(r => r.id)));
    
    for (const table of ['applications', 'receipts']) {
      const rows = db.prepare(`SELECT id FROM ${table}`).all() as { id: string }[];
      const byYear: Record<string, string[]> = {};
      for (const r of rows) {
        const parts = r.id.split('-');
        const year = parts[2];
        if (year) {
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(r.id);
        }
      }
      for (const year in byYear) {
        updateCounter(`${table.slice(0, -1)}-${year}`, getMaxSeq(byYear[year]));
      }
    }
    
    const certs = db.prepare('SELECT public_record FROM certificates').all() as { public_record: string }[];
    const certByYear: Record<string, string[]> = {};
    for (const c of certs) {
      const p = JSON.parse(c.public_record);
      const no = p.certificateNo || p.certNo;
      if (no && no.startsWith('NSH-C-')) {
        const parts = no.split('-');
        const year = parts[2];
        if (year) {
          if (!certByYear[year]) certByYear[year] = [];
          certByYear[year].push(no);
        }
      }
    }

    for (const year in certByYear) {
      updateCounter(`certificate-${year}`, getMaxSeq(certByYear[year]));
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedDemoData();
}
