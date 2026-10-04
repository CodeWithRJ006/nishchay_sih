import { db } from '../db/index.js';

export interface TamperBackupRecord {
  cert_id: string;
  original_record: string;
  tampered_at: number;
}

export function saveTamperBackup(certId: string, originalRecord: string, tamperedAt: number): void {
  db.prepare(`
    INSERT INTO certificate_tamper_backup (cert_id, original_record, tampered_at)
    VALUES (?, ?, ?)
    ON CONFLICT(cert_id) DO UPDATE SET
      original_record = excluded.original_record,
      tampered_at = excluded.tampered_at
  `).run(certId, originalRecord, tamperedAt);
}

export function getTamperBackupByCertId(certId: string): TamperBackupRecord | undefined {
  return db.prepare('SELECT cert_id, original_record, tampered_at FROM certificate_tamper_backup WHERE cert_id = ?').get(certId) as TamperBackupRecord | undefined;
}

export function getTamperBackupByPublicId(publicId: string): (TamperBackupRecord & { id: string }) | undefined {
  return db.prepare(`
    SELECT b.cert_id, b.original_record, b.tampered_at, c.id
    FROM certificate_tamper_backup b
    JOIN certificates c ON b.cert_id = c.id
    WHERE c.public_id = ?
  `).get(publicId) as (TamperBackupRecord & { id: string }) | undefined;
}

export function getAllTamperBackups(): TamperBackupRecord[] {
  return db.prepare('SELECT cert_id, original_record, tampered_at FROM certificate_tamper_backup').all() as TamperBackupRecord[];
}

export function deleteTamperBackup(certId: string): void {
  db.prepare('DELETE FROM certificate_tamper_backup WHERE cert_id = ?').run(certId);
}

export function restoreCertificateRecord(certId: string, originalRecord: string): void {
  db.prepare('UPDATE certificates SET public_record = ? WHERE id = ?').run(originalRecord, certId);
}
