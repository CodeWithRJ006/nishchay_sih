import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index.js';
import { canonicalJson } from '../../shared/src/canonicalJson.js';
import { ensureKeys } from './keys.js';

export function verifyFullSeal(publicId: string): boolean {
  // 1. Get certificate
  const cert = db.prepare('SELECT * FROM certificates WHERE public_id = ?').get(publicId) as Record<string, string>;
  if (!cert) return false;

  // 2. Parse public record
  let publicRecord: Record<string, string>;
  try {
    publicRecord = JSON.parse(cert.public_record);
  } catch {
    return false;
  }

  // 3. Verify signature
  const { publicKey } = ensureKeys();
  const verify = crypto.createVerify('SHA256');
  const hash = crypto.createHash('sha256').update(canonicalJson(publicRecord)).digest('hex');
  verify.update('nishchay-seal-v1:' + hash);
  if (!verify.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, cert.signature, 'hex')) {
    return false;
  }

  // 4. Gather private details
  const inspection = db.prepare('SELECT officer_id, gps_lat, gps_lng, gps_distance, checklist, readings FROM inspections WHERE application_id = ?').get(cert.application_id) as Record<string, string>;
  if (!inspection) return false;

  const photos = db.prepare('SELECT file_name, file_hash FROM inspection_photos WHERE application_id = ?').all(cert.application_id) as Record<string, string>[];

  // 5. Verify photo hashes by reading files
  const storageDir = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage', 'uploads');
  for (const p of photos) {
    const filePath = path.join(storageDir, p.file_name);
    try {
      const buf = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
      if (actualHash !== p.file_hash) return false;
    } catch {
      return false;
    }
  }

  const privateDetails = {
    officerId: inspection.officer_id,
    gpsLat: inspection.gps_lat,
    gpsLng: inspection.gps_lng,
    distance: inspection.gps_distance,
    checklist: JSON.parse(inspection.checklist),
    readings: JSON.parse(inspection.readings),
    photos: photos.map(r => ({ fileName: r.file_name, fileHash: r.file_hash }))
  };

  // 6. Compute detailsDigest using canonicalJson
  const detailsDigest = crypto.createHash('sha256').update(canonicalJson(privateDetails)).digest('hex');

  // 7. Check if it matches public record
  if (detailsDigest !== publicRecord.detailsDigest) {
    return false;
  }

  return true;
}
