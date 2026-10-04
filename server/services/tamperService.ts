import { clock } from '../../shared/src/clock.js';
import * as tamperRepo from '../repositories/tamperRepo.js';
import { db } from '../db/index.js';

export const AUTO_RESTORE_WINDOW_MS = 120 * 1000; // 2 minutes

export const ALLOWED_SAMPLE_IDS = [
  'sample-cert-val1d-0000',
  'sample-cert-exp1red-00',
  'sample-cert-rev0ked-00'
];

/**
 * Checks whether any tampered certificates are older than 2 minutes and restores them.
 * Can be called with a specific publicId or checks all backups.
 */
export function checkAndRestoreExpiredTampers(targetPublicId?: string): boolean {
  let restoredAny = false;
  const now = clock.now();

  if (targetPublicId) {
    const backup = tamperRepo.getTamperBackupByPublicId(targetPublicId);
    if (backup && now - backup.tampered_at >= AUTO_RESTORE_WINDOW_MS) {
      tamperRepo.restoreCertificateRecord(backup.cert_id, backup.original_record);
      tamperRepo.deleteTamperBackup(backup.cert_id);
      restoredAny = true;
    }
  }

  const all = tamperRepo.getAllTamperBackups();
  for (const b of all) {
    if (now - b.tampered_at >= AUTO_RESTORE_WINDOW_MS) {
      tamperRepo.restoreCertificateRecord(b.cert_id, b.original_record);
      tamperRepo.deleteTamperBackup(b.cert_id);
      restoredAny = true;
    }
  }

  return restoredAny;
}

export function isCertificateTampered(publicId: string): boolean {
  checkAndRestoreExpiredTampers(publicId);
  const backup = tamperRepo.getTamperBackupByPublicId(publicId);
  return Boolean(backup);
}

export function undoTamper(publicId: string): { success: boolean; message?: string; error?: string } {
  const backup = tamperRepo.getTamperBackupByPublicId(publicId);
  if (!backup) {
    return { success: false, error: 'No tamper backup found for this certificate' };
  }
  tamperRepo.restoreCertificateRecord(backup.cert_id, backup.original_record);
  tamperRepo.deleteTamperBackup(backup.cert_id);
  return { success: true, message: 'Certificate restored. Seal is valid again.' };
}

export function tamperCertificate(publicId: string): { success: boolean; error?: string; status?: number } {
  if (!ALLOWED_SAMPLE_IDS.includes(publicId)) {
    return { success: false, error: 'Only sample demonstrator certificates can be tampered', status: 400 };
  }

  const cert = db.prepare('SELECT id, public_record FROM certificates WHERE public_id = ?').get(publicId) as { id: string; public_record: string } | undefined;
  if (!cert) {
    return { success: false, error: 'Certificate not found', status: 404 };
  }

  let publicRecord: Record<string, unknown>;
  try {
    publicRecord = JSON.parse(cert.public_record) as Record<string, unknown>;
  } catch {
    return { success: false, error: 'Corrupt public_record', status: 500 };
  }

  const original = cert.public_record;
  publicRecord.tampered = true;
  const tampered = JSON.stringify(publicRecord);

  tamperRepo.saveTamperBackup(cert.id, original, clock.now());
  tamperRepo.restoreCertificateRecord(cert.id, tampered);

  return { success: true };
}
