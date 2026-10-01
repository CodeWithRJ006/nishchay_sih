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

export function updateBusinessProfile(req: Request, res: Response) {
  const user = (req as unknown as Record<string, unknown>).user as { id: string };
  const { name, type, address, zone_id, lat, lng, phone, email } = req.body;
  
  // Object policy already ran, but we enforce owner_id in the query anyway
  db.prepare(`
    UPDATE businesses 
    SET name = ?, type = ?, address = ?, zone_id = ?, lat = ?, lng = ?, phone = ?, email = ?
    WHERE owner_id = ?
  `).run(
    name ?? null, 
    type ?? null, 
    address ?? null, 
    zone_id ?? null, 
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
  const officer = db.prepare('SELECT id, name, role, zone_id, daily_capacity, gatc_centre_name FROM users WHERE id = ?').get(user.id);
  res.json(officer);
}

export function provisionOfficer(req: Request, res: Response) {
  const { email, name, role, zone_id, daily_capacity, gatc_centre_name } = req.body;
  if (role !== 'LMO' && role !== 'GATC') return res.status(400).json({ message: 'Invalid role' });
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ message: 'Email in use' });

  const id = `USR-${clock.now()}`;
  const hash = bcrypt.hashSync('demo123', 10); // default password for provisioned accounts
  
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, zone_id, daily_capacity, gatc_centre_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, hash, role, name, zone_id, daily_capacity, gatc_centre_name);
  
  res.json({ message: 'Provisioned', id });
}
