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

export function seedDemoData() {
  db.exec("INSERT OR REPLACE INTO counters (id, val) VALUES ('INS', 10), ('APP', 10), ('CRT', 10), ('JOB', 10), ('PAY', 10), ('PHO', 10), ('USR', 10)");
  const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number};
  if (usersCount.c > 0) return; // already seeded

  const { privateKey } = ensureKeys();

  const pwHash = bcrypt.hashSync('demo123', 10);
  
  transaction(() => {
    // 1 admin, 2 LMOs, 1 GATC
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-ADMIN', 'admin@nishchay.example', pwHash, 'ADMIN', 'Admin User', null);
      
    db.prepare('INSERT INTO zones (id, code, name) VALUES (?, ?, ?)')
      .run('ZONE-1', 'Z-DL-01', 'Delhi North');
    db.prepare('INSERT INTO zones (id, code, name) VALUES (?, ?, ?)')
      .run('ZONE-2', 'Z-DL-02', 'Delhi South');

    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-LMO1', 'lmo1@nishchay.example', pwHash, 'LMO', 'LMO North', 'ZONE-1');
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-LMO2', 'lmo2@nishchay.example', pwHash, 'LMO', 'LMO South', 'ZONE-2');
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-GATC1', 'gatc1@nishchay.example', pwHash, 'GATC', 'GATC Central', null);
    db.prepare('INSERT INTO users (id, email, password_hash, role, name, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run('USR-GATC2', 'gatc2@nishchay.example', pwHash, 'GATC', 'GATC West', null);

    // 3 businesses
    const b1 = 'BIZ-1';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ1', 'biz1@nishchay.example', pwHash, 'BUSINESS', 'Biz One Owner');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(b1, 'USR-BIZ1', 'Biz One', '123 Market', 'ZONE-1');

    const b2 = 'BIZ-2';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ2', 'biz2@nishchay.example', pwHash, 'BUSINESS', 'Biz Two Owner');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(b2, 'USR-BIZ2', 'Biz Two', '456 Street', 'ZONE-2');
      
    const b3 = 'BIZ-3';
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run('USR-BIZ3', 'biz3@nishchay.example', pwHash, 'BUSINESS', 'Biz Three Owner');
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(b3, 'USR-BIZ3', 'Biz Three (NAWI)', '789 Road', 'ZONE-1');

    // NAWI routed to GATC
    const i1 = generateId.instrument(1);
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(i1, b3, 'NAWI-3', 'WeighCorp', 'M-100', '150kg', 'SER-000001');

    db.prepare("INSERT INTO counters (id, val) VALUES ('instrument', 1)").run();

    const paidTime = new Date().toISOString();
    const dummyName = `dummy-${crypto.randomBytes(4).toString('hex')}.png`;
    const photoHash = crypto.createHash('sha256').update('dummy').digest('hex');
    const storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage', 'uploads');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    fs.writeFileSync(path.join(storageDir, dummyName), Buffer.from('dummy'));

    const privateDetails = {
      officerId: 'USR-LMO1',
      gpsLat: 28.0,
      gpsLng: 77.0,
      distance: 10,
      checklist: ['ok'],
      readings: [{val:1}],
      photos: [{ fileName: dummyName, fileHash: photoHash }]
    };
    const detailsDigest = crypto.createHash('sha256').update(canonicalJson(privateDetails)).digest('hex');

    const createFullCert = (appId: string, recId: string, payId: string, publicId: string, certNo: string, validFrom: string, validTo: string, status: string, bId: string, iId: string) => {
      // Create Application
      db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
        .run(appId, bId, iId, 'CERTIFIED', 500, 'Routed to GATC');
      
      // Create Payment & Receipt
      db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
        .run(payId, appId, 'idem-' + recId, 500, 'PAID');
      
      const payload = `${recId}:${appId}:${iId}:500:${paidTime}`;
      const hmac = crypto.createHmac('sha256', hmacSecret());
      hmac.update(payload);
      const receiptSignature = hmac.digest('hex');

      db.prepare('INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(recId, appId, payId, 500, receiptSignature, paidTime);

      // Create Inspection & Photo
      db.prepare('INSERT INTO inspections (id, application_id, officer_id, gps_lat, gps_lng, gps_distance, checklist, readings, pass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run('INSP-' + appId, appId, 'USR-LMO1', 28.0, 77.0, 10, JSON.stringify(['ok']), JSON.stringify([{val:1}]), 1);
      
      db.prepare('INSERT INTO inspection_photos (id, application_id, uploader_id, file_name, file_hash, client_capture_time, server_receive_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run('PHO-' + appId, appId, 'USR-LMO1', dummyName, photoHash, paidTime, paidTime);

      // Cert
      const bName = (db.prepare('SELECT name FROM businesses WHERE id = ?').get(bId) as { name: string }).name;
      const iData = db.prepare('SELECT type_code, serial FROM instruments WHERE id = ?').get(iId) as { type_code: string; serial: string };
      const publicRecord = {
        v: 1,
        certNo,
        instrumentId: iId,
        tradeName: bName,
        instrumentClass: iData.type_code,
        serialNo: iData.serial || iId,
        validFrom,
        validTo,
        authorityName: 'LMO Demo',
        receiptDigest: crypto.createHash('sha256').update(JSON.stringify({ id: recId, amount: 500 })).digest('hex'),
        detailsDigest
      };

      const publicRecordStr = JSON.stringify(publicRecord);
      const sealHash = crypto.createHash('sha256').update(publicRecordStr).digest('hex');
      const signature = signHash(sealHash, privateKey);
      const keyId = crypto.createHash('sha256').update(ensureKeys().publicKeySpkiHex).digest('hex').slice(0, 8);
      
      db.prepare('INSERT INTO certificates (public_id, application_id, instrument_id, receipt_id, valid_from, valid_to, hash, signature, key_id, public_record, details_digest, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(publicId, appId, iId, recId, validFrom, validTo, sealHash, signature, keyId, publicRecordStr, detailsDigest, status);
    };

    const now = clock.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const validIssued = new Date(now - 30 * dayMs).toISOString();
    const validValidTo = new Date(now + 335 * dayMs).toISOString();
    createFullCert(generateId.application(2025, 1), generateId.receipt(2025, 1), 'PAY-1', DEMO_CERT_VALID, generateId.certificate(2025, 1), validIssued, validValidTo, 'VALID', b3, i1);

    const expiredIssued = new Date(now - 400 * dayMs).toISOString();
    const expiredValidTo = new Date(now - 35 * dayMs).toISOString();
    createFullCert(generateId.application(2025, 2), generateId.receipt(2025, 2), 'PAY-2', DEMO_CERT_EXPIRED, generateId.certificate(2025, 2), expiredIssued, expiredValidTo, 'EXPIRED', b3, i1);

    const revokedIssued = new Date(now - 30 * dayMs).toISOString();
    const revokedValidTo = new Date(now + 335 * dayMs).toISOString();
    createFullCert(generateId.application(2025, 3), generateId.receipt(2025, 3), 'PAY-3', DEMO_CERT_REVOKED, generateId.certificate(2025, 3), revokedIssued, revokedValidTo, 'REVOKED', b3, i1);

    // Create an application at INSPECTED_PASS state ready for gate test
    const app4 = generateId.application(2025, 4);
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app4, b3, i1, 'INSPECTED_PASS', 500, 'Routed to GATC');
    
    const rec4 = generateId.receipt(2025, 4);
    const pay4 = 'PAY-4';
    db.prepare('INSERT INTO payments (id, application_id, idempotency_key, amount, status) VALUES (?, ?, ?, ?, ?)')
      .run(pay4, app4, 'idem4', 500, 'PAID');
      
    const payload4 = `${rec4}:${app4}:${i1}:500:${paidTime}`;
    const hmac4 = crypto.createHmac('sha256', hmacSecret());
    hmac4.update(payload4);
    const receiptSignature4 = hmac4.digest('hex');

    db.prepare('INSERT INTO receipts (id, application_id, payment_id, amount, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(rec4, app4, pay4, 500, receiptSignature4, paidTime);

    // Create a SCHEDULED application for USR-LMO1
    const app5 = generateId.application(2025, 5);
    // Use an existing business and instrument (b2 is LMO-routed typically, wait b2 is there? b1 is b3 is there. Let's just create one)
    const b4 = 'BIZ-LMO-TEST';
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, type, zone_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(b4, 'USR-BIZ1', 'Demo Field Business', 'Demo Field Address', 'DEALER', 'ZONE-1');
    const i4 = generateId.instrument(4);
    db.prepare('INSERT INTO instruments (id, business_id, type_code, make, model, capacity) VALUES (?, ?, ?, ?, ?, ?)')
      .run(i4, b4, 'W-1', 'WeighCorp', 'M-100', '10kg');
    db.prepare('INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule) VALUES (?, ?, ?, ?, ?, ?)')
      .run(app5, b4, i4, 'ACCEPTED', 300, 'Routed to LMO');
    db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run('APT-1', app5, 'USR-LMO1', '2026-10-10', 'Morning', 'SCHEDULED');
      
    // Sync counters for everything using shared/src/ids.ts format
    const updateCounter = (key: string, val: number) => {
      const current = (db.prepare('SELECT val FROM counters WHERE id = ?').get(key) as { val: number })?.val || 0;
      if (val > current) {
        db.prepare('INSERT OR REPLACE INTO counters (id, val) VALUES (?, ?)').run(key, val);
      }
    };

    const getMaxSeq = (ids: string[]) => Math.max(0, ...ids.map(id => parseInt(id.split('-').pop() || '0', 10)));
    
    updateCounter('instrument', getMaxSeq((db.prepare('SELECT id FROM instruments').all() as {id:string}[]).map(r=>r.id)));
    
    for (const table of ['applications', 'receipts']) {
      const rows = db.prepare(`SELECT id FROM ${table}`).all() as {id:string}[];
      const byYear: Record<string, string[]> = {};
      for (const r of rows) {
        const year = r.id.split('-')[2];
        if (!byYear[year]) byYear[year] = [];
        byYear[year].push(r.id);
      }
      for (const year in byYear) {
        updateCounter(`${table.slice(0,-1)}-${year}`, getMaxSeq(byYear[year]));
      }
    }
    
    const certs = db.prepare('SELECT public_record FROM certificates').all() as {public_record:string}[];
    const certByYear: Record<string, string[]> = {};
    for (const c of certs) {
      const p = JSON.parse(c.public_record);
      if (p.certNo && p.certNo.startsWith('NSH-C-')) {
        const year = p.certNo.split('-')[2];
        if (!certByYear[year]) certByYear[year] = [];
        certByYear[year].push(p.certNo);
      }
    }

    db.prepare("UPDATE users SET daily_capacity = 100 WHERE role IN ('LMO', 'GATC')").run();

    for (const year in certByYear) {
      updateCounter(`certificate-${year}`, getMaxSeq(certByYear[year]));
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  // if run directly
  seedDemoData();
}
