import { db, nextSequence } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';
import { computeFee, requiresGatc } from '../../shared/src/rules.js';

export function getInstrumentForBusiness(instrumentId: string, bizId: string) {
  return db.prepare('SELECT type_code FROM instruments WHERE id = ? AND business_id = ?').get(instrumentId, bizId) as { type_code: string } | undefined;
}

export function hasPendingApplication(instrumentId: string) {
  const pending = db.prepare("SELECT id FROM applications WHERE instrument_id = ? AND state NOT IN ('CERTIFIED', 'FAILED', 'CANCELLED')").get(instrumentId);
  return !!pending;
}

export function insertApplication(bizId: string, instrumentId: string, documents: Array<{ doc_type: string, file_name: string, file_hash: string }>, userId: string, typeCode: string) {
  const seq = nextSequence('application');
  const id = generateId.application(new Date().getFullYear(), seq);

  const fee = computeFee(typeCode);
  const routing = requiresGatc(typeCode) ? 'GATC' : 'LMO';
  const routingRule = `Routed to ${routing}`;

  db.prepare(`
    INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule)
    VALUES (?, ?, ?, 'SUBMITTED', ?, ?)
  `).run(id, bizId, instrumentId, fee, routingRule);

  const insertDoc = db.prepare(`
    INSERT INTO application_documents (id, application_id, doc_type, file_url, file_hash)
    VALUES (hex(randomblob(16)), ?, ?, ?, ?)
  `);

  for (const doc of documents) {
    insertDoc.run(id, doc.doc_type, doc.file_name, doc.file_hash);
  }

  db.prepare(`
    INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
    VALUES (hex(randomblob(16)), 'applications', ?, 'CREATE', ?, ?)
  `).run(id, userId, JSON.stringify({ state: 'SUBMITTED', fee, routingRule }));

  return { id, fee_amount: fee, routingRule };
}

export function findApplicationsByBusiness(bizId: string) {
  return db.prepare('SELECT * FROM applications WHERE business_id = ? ORDER BY created_at DESC').all(bizId);
}

export function findApplicationById(id: string) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Record<string, unknown> | undefined;
}
