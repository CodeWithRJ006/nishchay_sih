import { Request, Response } from 'express';
import { db } from '../db/index.js';
import bcrypt from 'bcryptjs';
import { clock } from '../../shared/src/clock.js';

export function getBusinessProfile(req: Request, res: Response) {
  const user = (req as unknown as Record<string, unknown>).user as { id: string };
  const biz = db.prepare('SELECT * FROM businesses WHERE owner_id = ?').get(user.id);
  if (!biz) return res.status(404).json({ message: 'Not found' });
  res.json(biz);
}

import { z } from 'zod';

const updateBizSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  address: z.string().min(1),
  zone_id: z.string().min(1),
  lat: z.string().optional(),
  lng: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional()
});

export function updateBusinessProfile(req: Request, res: Response) {
  const user = (req as unknown as Record<string, unknown>).user as { id: string };
  const parse = updateBizSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: 'Validation failed', errors: parse.error.errors });
  
  const { name, type, address, zone_id, lat, lng, phone, email } = parse.data;
  
  // Object policy already ran, but we enforce owner_id in the query anyway
  db.prepare(`
    UPDATE businesses 
    SET name = ?, type = ?, address = ?, zone_id = ?, lat = ?, lng = ?, phone = ?, email = ?
    WHERE owner_id = ?
  `).run(
    name, 
    type ?? null, 
    address, 
    zone_id, 
    lat ?? null, 
    lng ?? null, 
    phone ?? null, 
    email ?? null, 
    user.id
  );
  
  res.json({ message: 'Profile updated' });
}

export function getOfficerProfile(req: Request, res: Response) {
  const user = (req as unknown as Record<string, unknown>).user as { id: string };
  const officer = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.zone_id, u.daily_capacity, u.gatc_centre_name, z.name as zone_name
    FROM users u
    LEFT JOIN zones z ON u.zone_id = z.id
    WHERE u.id = ?
  `).get(user.id) as {
    id: string;
    name: string;
    email: string;
    role: string;
    zone_id: string | null;
    daily_capacity: number | null;
    gatc_centre_name: string | null;
    zone_name: string | null;
  } | undefined;

  if (!officer) return res.status(404).json({ message: 'Officer not found' });

  const todayStr = new Date(clock.now()).toISOString().split('T')[0];
  const todayLoad = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE officer_id = ? AND slot_date = ?').get(user.id, todayStr) as { c: number }).c;
  const totalAssigned = (db.prepare('SELECT COUNT(*) as c FROM appointments WHERE officer_id = ?').get(user.id) as { c: number }).c;
  const totalCompleted = (db.prepare(`
    SELECT COUNT(*) as c 
    FROM applications a 
    JOIN appointments ap ON a.id = ap.application_id 
    WHERE ap.officer_id = ? AND a.state IN ('CERTIFIED', 'INSPECTED_PASS', 'FAILED')
  `).get(user.id) as { c: number }).c;

  res.json({
    ...officer,
    today_load: todayLoad,
    total_assigned: totalAssigned,
    total_completed: totalCompleted,
  });
}

export function provisionOfficer(req: Request, res: Response) {
  const { email, name, role, zone_id, daily_capacity, gatc_centre_name } = req.body;
  if (role !== 'LMO' && role !== 'GATC') return res.status(400).json({ message: 'Invalid role' });
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ message: 'Email in use' });

  const id = `USR-${clock.now()}`;
  const defaultPassword = 'demo123';
  const hash = bcrypt.hashSync(defaultPassword, 10); // default password for provisioned accounts
  
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, zone_id, daily_capacity, gatc_centre_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, hash, role, name, zone_id, daily_capacity, gatc_centre_name);

  const adminUser = (req as unknown as Record<string, unknown>).user as { id: string } | undefined;
  db.prepare(`
    INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data)
    VALUES (hex(randomblob(16)), 'users', ?, 'PROVISION_OFFICER', ?, ?)
  `).run(id, adminUser?.id || 'ADMIN', JSON.stringify({ email, role, name }));
  
  res.json({ message: 'Provisioned', id, email, name, role, defaultPassword });
}
