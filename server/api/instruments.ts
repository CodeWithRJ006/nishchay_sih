import { Request, Response } from 'express';
import { z } from 'zod';
import { db, transaction } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';

const instrumentSchema = z.object({
  type_code: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  capacity: z.string().min(1),
  serial: z.string().min(1),
  accuracy_class: z.string().optional(),
  location: z.string().optional()
});

export function registerInstrument(req: Request, res: Response) {
  const user = (req as any).user;
  if (user.role !== 'BUSINESS') return res.status(403).json({ message: 'Forbidden' });

  const parse = instrumentSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: 'Validation failed', errors: parse.error.errors });

  const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(user.id) as { id: string } | undefined;
  if (!biz) return res.status(403).json({ message: 'Business profile not found' });

  const data = parse.data;

  // Check unique serial per business
  const existing = db.prepare('SELECT id FROM instruments WHERE business_id = ? AND serial = ?').get(biz.id, data.serial);
  if (existing) return res.status(409).json({ message: 'Duplicate serial number for this business' });

  transaction(() => {
    let seqRow = db.prepare("SELECT val FROM counters WHERE id = 'instrument'").get() as { val: number } | undefined;
    let seq = 1;
    if (seqRow) {
      seq = seqRow.val + 1;
      db.prepare("UPDATE counters SET val = ? WHERE id = 'instrument'").run(seq);
    } else {
      db.prepare("INSERT INTO counters (id, val) VALUES ('instrument', 1)").run();
    }

    const id = generateId.instrument(seq);

    db.prepare(`
      INSERT INTO instruments (id, business_id, type_code, make, model, capacity, serial, accuracy_class, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, biz.id, data.type_code, data.make, data.model, data.capacity, data.serial, data.accuracy_class || null, data.location || null);

    db.prepare(`
      INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
      VALUES (hex(randomblob(16)), 'instruments', ?, 'CREATE', ?, ?)
    `).run(id, user.id, JSON.stringify(data));

    res.status(201).json({ id, message: 'Instrument registered' });
  });
}

export function listInstruments(req: Request, res: Response) {
  const user = (req as any).user;
  if (user.role !== 'BUSINESS') return res.status(403).json({ message: 'Forbidden' });

  const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(user.id) as { id: string } | undefined;
  if (!biz) return res.json([]);

  const instruments = db.prepare('SELECT * FROM instruments WHERE business_id = ?').all(biz.id);
  res.json(instruments);
}

export function getInstrument(req: Request, res: Response) {
  const id = req.params.id;
  const instrument = db.prepare('SELECT * FROM instruments WHERE id = ?').get(id) as any;
  if (!instrument) return res.status(404).json({ message: 'Not found' });

  // Object-level access
  const user = (req as any).user;
  if (user.role === 'BUSINESS') {
    const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(user.id) as { id: string } | undefined;
    if (!biz || instrument.business_id !== biz.id) return res.status(403).json({ message: 'Forbidden' });
  }
  
  res.json(instrument);
}
