import { Request, Response } from 'express';
import { z } from 'zod';
import { db, transaction } from '../db/index.js';
import { generateId } from '../../shared/src/ids.js';
import { computeFee, requiresGatc } from '../../shared/src/rules.js';

const appSchema = z.object({
  instrument_id: z.string().min(1),
  documents: z.array(z.object({
    doc_type: z.string().min(1),
    file_name: z.string().min(1),
    file_hash: z.string().min(1)
  })).min(1)
});

export function createApplication(req: Request, res: Response) {
  const user = (req as any).user;
  if (user.role !== 'BUSINESS') return res.status(403).json({ message: 'Forbidden' });

  const parse = appSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: 'Validation failed', errors: parse.error.errors });
  
  const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(user.id) as { id: string } | undefined;
  if (!biz) return res.status(403).json({ message: 'Business profile not found' });

  const data = parse.data;

  // Verify instrument belongs to business
  const instrument = db.prepare('SELECT type_code FROM instruments WHERE id = ? AND business_id = ?').get(data.instrument_id, biz.id) as { type_code: string } | undefined;
  if (!instrument) return res.status(403).json({ message: 'Instrument not found or does not belong to you' });

  // Only one pending app per instrument
  const pending = db.prepare("SELECT id FROM applications WHERE instrument_id = ? AND state NOT IN ('CERTIFIED', 'FAILED', 'CANCELLED')").get(data.instrument_id);
  if (pending) return res.status(409).json({ message: 'Pending application already exists for this instrument' });

  const fee = computeFee(instrument.type_code);
  const routing = requiresGatc(instrument.type_code) ? 'GATC' : 'LMO';
  const routingRule = `Routed to ${routing}`;

  transaction(() => {
    let seqRow = db.prepare("SELECT val FROM counters WHERE id = 'application'").get() as { val: number } | undefined;
    let seq = 1;
    if (seqRow) {
      seq = seqRow.val + 1;
      db.prepare("UPDATE counters SET val = ? WHERE id = 'application'").run(seq);
    } else {
      db.prepare("INSERT INTO counters (id, val) VALUES ('application', 1)").run();
    }

    const id = generateId.application(new Date().getFullYear(), seq);

    db.prepare(`
      INSERT INTO applications (id, business_id, instrument_id, state, fee_amount, routing_rule)
      VALUES (?, ?, ?, 'SUBMITTED', ?, ?)
    `).run(id, biz.id, data.instrument_id, fee, routingRule);

    const insertDoc = db.prepare(`
      INSERT INTO application_documents (id, application_id, doc_type, file_url, file_hash)
      VALUES (hex(randomblob(16)), ?, ?, ?, ?)
    `);

    for (const doc of data.documents) {
      insertDoc.run(id, doc.doc_type, doc.file_name, doc.file_hash);
    }

    db.prepare(`
      INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
      VALUES (hex(randomblob(16)), 'applications', ?, 'CREATE', ?, ?)
    `).run(id, user.id, JSON.stringify({ state: 'SUBMITTED', fee, routingRule }));

    res.status(201).json({ id, message: 'Application submitted', fee_amount: fee, routingRule });
  });
}

export function listApplications(req: Request, res: Response) {
  const user = (req as any).user;
  let apps: any[] = [];
  if (user.role === 'BUSINESS') {
    const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(user.id) as { id: string } | undefined;
    if (biz) {
      apps = db.prepare('SELECT * FROM applications WHERE business_id = ? ORDER BY created_at DESC').all(biz.id);
    }
  }
  res.json(apps);
}

export function getApplication(req: Request, res: Response) {
  const id = req.params.id;
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as any;
  if (!app) return res.status(404).json({ message: 'Not found' });

  // Object-level access
  const user = (req as any).user;
  if (user.role === 'BUSINESS') {
    const biz = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').get(user.id) as { id: string } | undefined;
    if (!biz || app.business_id !== biz.id) return res.status(403).json({ message: 'Forbidden' });
  }
  
  res.json(app);
}
