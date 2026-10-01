import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { recordAudit } from '../repositories/appointmentsRepo.js';

export function arriveAtJob(req: Request, res: Response) {
  const { id } = req.params; // application_id
  const userId = req.user!.id;
  
  // Verify it's ACCEPTED
  const app = db.prepare('SELECT state FROM applications WHERE id = ?').get(id) as { state: string } | undefined;
  if (!app) return res.status(404).json({ error: 'Not found' });
  
  if (app.state !== 'ACCEPTED') {
    return res.status(409).json({ error: 'Application must be ACCEPTED to arrive' });
  }

  const appointment = db.prepare('SELECT status FROM appointments WHERE application_id = ? AND officer_id = ?').get(id, userId) as { status: string } | undefined;
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  if (appointment.status !== 'ACCEPTED') {
    return res.status(409).json({ error: 'Appointment must be ACCEPTED to arrive' });
  }

  // Transaction to update and log
  const arrive = db.transaction(() => {
    db.prepare('UPDATE appointments SET status = ? WHERE application_id = ?').run('ARRIVED', id);
    recordAudit(id, userId, 'ARRIVED', 'Officer arrived at premises');
  });

  arrive();
  res.json({ success: true });
}
