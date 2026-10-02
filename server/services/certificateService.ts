import { db } from '../db/index.js';
import { transaction } from '../db/index.js';
import { clock } from '../../shared/src/clock.js';
import { canonicalJson } from '../../shared/src/canonicalJson.js';
import crypto from 'node:crypto';
import { recordAudit } from '../repositories/auditRepo.js';


export interface PrivateDetails {
  officerId: string;
  gpsLat: number;
  gpsLng: number;
  distance: number;
  checklist: string[];
  readings: { applied: number; observed: number }[];
  photos: { fileName: string; fileHash: string }[];
}

export class CertificateService {
  async issueCertificate(applicationId: string, officerId: string): Promise<string> {
    // Validate fee-gate
// Validate fee-gate (removed unused variable)
  // Use existing checkFeeGate logic from paymentsService
  const check = (await import('../services/paymentsService.js')).checkFeeGate;
  if (!check(applicationId, officerId)) throw new Error('Fee gate not satisfied');

    // Gather data
    const app = db.prepare('SELECT id, instrument_id, fee_amount, state FROM applications WHERE id = ?').get(applicationId) as { id: string; instrument_id: string; fee_amount: number; state: string } | undefined;
    if (!app) throw new Error('Application not found');
    if (app.state !== 'INSPECTED_PASS') throw new Error('Application not inspected pass');

    const receipt = db.prepare('SELECT id, amount, signature FROM receipts WHERE application_id = ?').get(applicationId) as { id: string; amount: number; signature: string } | undefined;
    if (!receipt) throw new Error('Receipt not found');

    const instrument = db.prepare('SELECT type_code, serial FROM instruments WHERE id = ?').get(app.instrument_id) as { type_code: string; serial: string } | undefined;
    if (!instrument) throw new Error('Instrument not found');

    // Private details from inspection
    const inspection = db.prepare('SELECT gps_lat, gps_lng, gps_distance, checklist, readings FROM inspections WHERE application_id = ?').get(applicationId) as { gps_lat: number; gps_lng: number; gps_distance: number; checklist: string; readings: string };
    const photosRows = db.prepare('SELECT file_name, file_hash FROM inspection_photos WHERE application_id = ?').all(applicationId) as { file_name: string; file_hash: string }[];
    const privateDetails: PrivateDetails = {
      officerId,
      gpsLat: inspection.gps_lat,
      gpsLng: inspection.gps_lng,
      distance: inspection.gps_distance,
      checklist: JSON.parse(inspection.checklist) as string[],
      readings: JSON.parse(inspection.readings) as { applied: number; observed: number }[],
      photos: photosRows.map((r: { file_name: string; file_hash: string }) => ({ fileName: r.file_name, fileHash: r.file_hash }))
    };

    const businessData = db.prepare('SELECT name as trade_name FROM businesses WHERE id = (SELECT business_id FROM applications WHERE id = ?)').get(applicationId) as { trade_name: string };
    // Build public record
    const publicRecord = {
      v: 1,
      certificateNo: '', // placeholder, will be filled later
      instrumentId: app.instrument_id,
      tradeName: businessData.trade_name,
      instrumentClass: instrument.type_code,
      serialNo: instrument.serial,
      validFrom: new Date(clock.now()).toISOString(),
      validTo: new Date(clock.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year validity as example
      authorityName: 'LMO Demo',
      receiptDigest: crypto.createHash('sha256').update(JSON.stringify({ id: receipt.id, amount: receipt.amount })).digest('hex'),
      detailsDigest: crypto.createHash('sha256').update(canonicalJson(privateDetails as unknown as Record<string, unknown>)).digest('hex')
    };

    const publicRecordStr = JSON.stringify(publicRecord);
    const hash = crypto.createHash('sha256').update(publicRecordStr).digest('hex');
    const keyPair = await this.getKeyPair();
    const sign = crypto.createSign('SHA256');
    sign.update('nishchay-seal-v1:' + hash);
    const signature = sign.sign(keyPair.privateKey, 'hex');
    const keyId = crypto.createHash('sha256').update(keyPair.publicKey).digest('hex').slice(0, 8);

    const publicId = crypto.randomBytes(16).toString('base64url').replace(/=+$/,''); // 128‑bit base64url

    // Insert certificate in a transaction
    transaction(() => {
      db.prepare(`INSERT INTO certificates (public_id, application_id, instrument_id, receipt_id, public_record, hash, signature, key_id, valid_from, valid_to, status, details_digest, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID', ?, CURRENT_TIMESTAMP)`).run(
        publicId,
        app.id,
        app.instrument_id,
        receipt.id,
        publicRecordStr,
        hash,
        signature,
        keyId,
        publicRecord.validFrom,
        publicRecord.validTo,
        crypto.createHash('sha256').update(canonicalJson(privateDetails as unknown as Record<string, unknown>)).digest('hex')
      );
      // Update application state
      db.prepare('UPDATE applications SET state = ? WHERE id = ?').run('CERTIFIED', app.id);
      recordAudit(app.id, officerId, 'CERTIFICATE_ISSUED', JSON.stringify({ publicId }));
    });

    return publicId;
  }

  async getCertificate(publicId: string) {
    const row = db.prepare('SELECT * FROM certificates WHERE public_id = ?').get(publicId) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Certificate not found');
    return row;
  }

  async revokeCertificate(publicId: string, reason: string, adminId: string) {
    const row = db.prepare('SELECT * FROM certificates WHERE public_id = ?').get(publicId) as { application_id: string; status: string } | undefined;
    if (!row) throw new Error('Certificate not found');
    if (row.status !== 'VALID') throw new Error('Only VALID certificates can be revoked');
    db.prepare('UPDATE certificates SET status = ?, revoked_reason = ? WHERE public_id = ?').run('REVOKED', reason, publicId);
    recordAudit(row.application_id, adminId, 'CERTIFICATE_REVOKED', JSON.stringify({ reason }));
    return true;
  }

  async getPublicKeys() {
    const { publicKey } = await this.getKeyPair();
    return publicKey;
  }

  private async getKeyPair(): Promise<{ publicKey: Buffer; privateKey: Buffer }> {
    const fs = await import('fs');
    const path = await import('path');
    const keyDir = path.resolve(process.cwd(), '.keys');
    const pubPath = path.join(keyDir, 'public.pem');
    const privPath = path.join(keyDir, 'private.pem');
    if (!fs.existsSync(pubPath) || !fs.existsSync(privPath)) {
      const { generateKeyPairSync } = await import('node:crypto');
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      fs.mkdirSync(keyDir, { recursive: true });
      fs.writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }));
      fs.writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
    }
    const publicKey = fs.readFileSync(pubPath);
    const privateKey = fs.readFileSync(privPath);
    return { publicKey, privateKey };
  }
}

export const certificateService = new CertificateService();
