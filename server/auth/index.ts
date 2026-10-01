import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, transaction } from '../db/index.js';
import { clock } from '../../shared/src/clock.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      (req as unknown as Record<string, unknown>).user = decoded;
    } catch {
      // invalid token, user is PUBLIC
    }
  }
  next();
};

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && !req.path.startsWith('/api/auth/') && !req.path.startsWith('/api/demo/')) {
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfHeader) {
      res.status(403).json({ code: 'CSRF_MISSING', message: 'CSRF token missing' });
      return;
    }
  }
  next();
};

export function loginRoute(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'Email and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  if (user.locked_until && new Date(user.locked_until as string).getTime() > clock.now()) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Account locked' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash as string);
  if (!valid) {
    const attempts = (user.failed_attempts as number) + 1;
    if (attempts >= 5) {
      const lockedUntil = new Date(clock.now() + 15 * 60 * 1000).toISOString();
      db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockedUntil, user.id);
    } else {
      db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
    }
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid credentials' });
  }

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

  const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.json({ id: user.id, role: user.role, name: user.name });
}

import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  address: z.string().min(1),
  zone_id: z.string().optional()
});

export function registerRoute(req: Request, res: Response) {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'Validation failed', errors: parse.error.errors });
  }
  const { email, password, name, address, zone_id } = parse.data;
  
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ code: 'EXISTS', message: 'Email taken' });

  const hash = bcrypt.hashSync(password, 10);
  const userId = `USR-${clock.now()}`;
  const businessId = `BIZ-${clock.now()}`;

  transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run(userId, email, hash, 'BUSINESS', name);
    
    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(businessId, userId, name, address, zone_id || 'ZONE-1');
  });

  res.status(201).json({ message: 'Registered' });
}

export function logoutRoute(req: Request, res: Response) {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
}

export function meRoute(req: Request, res: Response) {
  res.json((req as unknown as Record<string, unknown>).user);
}
