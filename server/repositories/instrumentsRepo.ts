import { db, nextSequence } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';

export function getBusinessByOwner(ownerId: string) {
  return db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(ownerId) as { id: string } | undefined;
}

export function insertInstrument(bizId: string, data: Record<string, unknown>, userId: string) {
  const seq = nextSequence('instrument');
  const id = generateId.instrument(seq);

  db.prepare(`
    INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, bizId, data.type_code, data.make, data.model, data.capacity, data.serial, data.accuracy_class || null, data.location || null);

  db.prepare(`
    INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
    VALUES (hex(randomblob(16)), 'instruments', ?, 'CREATE', ?, ?)
  `).run(id, userId, JSON.stringify(data));

  return id;
}

export function findInstrumentsByBusiness(bizId: string) {
  return db.prepare('SELECT * FROM instruments WHERE business_id = ?').all(bizId);
}

export function findInstrumentById(id: string) {
  return db.prepare('SELECT * FROM instruments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
}
