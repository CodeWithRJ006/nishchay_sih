import { db } from '../db/index.js';

export function findApplicationByDocumentUrl(fileUrl: string) {
  const doc = db.prepare('SELECT application_id FROM application_documents WHERE file_url = ?').get(fileUrl) as { application_id: string } | undefined;
  if (!doc) return undefined;
  return db.prepare('SELECT business_id, assigned_officer_id FROM applications WHERE id = ?').get(doc.application_id) as Record<string, unknown> | undefined;
}
