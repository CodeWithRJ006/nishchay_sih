import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { db, transaction, nextSequence } from '../db/index.js';
import { clock } from '../../shared/src/clock.js';
import '../types.js';
import { jwtSecret } from '../config/secrets.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, jwtSecret()) as Express.Request['user'];
      req.user = decoded;
    } catch {
      // invalid token, user is PUBLIC
    }
  }
  next();
};

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const isSecure = process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https');

  const incomingCsrfCookie = req.cookies?.csrf;
  if (!incomingCsrfCookie && !req.path.startsWith('/api/auth/login') && !req.path.startsWith('/api/demo/login-as')) {
    const newCsrf = crypto.randomBytes(16).toString('hex');
    res.cookie('csrf', newCsrf, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/'
    });
  }

  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (mutatingMethods.includes(req.method)) {
    if (req.path === '/api/payments/callback') {
      return next();
    }
    if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/demo/login-as')) {
      return next();
    }

    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfHeader) {
      res.status(403).json({ code: 'CSRF_MISSING', message: 'CSRF token missing' });
      return;
    }

    if (incomingCsrfCookie && csrfHeader !== incomingCsrfCookie) {
      res.status(403).json({ code: 'CSRF_MISMATCH', message: 'CSRF token mismatch' });
      return;
    }
  }
  next();
};

interface LockoutRecord {
  attempts: number;
  lockedUntil: number;
}
const failedLogins = new Map<string, LockoutRecord>();

export function resetLockouts(): void {
  failedLogins.clear();
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts. Please try again later.' }
});

export function loginRoute(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'Email and password required' });
  }

  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const lockoutKey = `${String(email).trim().toLowerCase()}:${clientIp}`;
  const lockout = failedLogins.get(lockoutKey);

  if (lockout && lockout.lockedUntil > clock.now()) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;
  if (!user) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash as string);
  if (!valid) {
    const currentAttempts = (lockout ? lockout.attempts : 0) + 1;
    if (currentAttempts >= 5) {
      failedLogins.set(lockoutKey, {
        attempts: currentAttempts,
        lockedUntil: clock.now() + 15 * 60 * 1000
      });
    } else {
      failedLogins.set(lockoutKey, {
        attempts: currentAttempts,
        lockedUntil: 0
      });
    }
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
  }

  failedLogins.delete(lockoutKey);

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    jwtSecret(),
    { expiresIn: '1d' }
  );
  const isSecure = process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.json({ id: user.id, role: user.role, name: user.name });
}

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'TOO_MANY_REQUESTS', message: 'Too many registration attempts. Please try again later.' }
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  address: z.string().optional().default('Hyderabad'),
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
  const userSeq = nextSequence('users');
  const bizSeq = nextSequence('businesses');
  const userId = `USR-${String(userSeq).padStart(4, '0')}`;
  const businessId = `BIZ-${String(bizSeq).padStart(4, '0')}`;

  transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)')
      .run(userId, email, hash, 'BUSINESS', name);

    db.prepare('INSERT INTO businesses (id, owner_id, name, address, zone_id) VALUES (?, ?, ?, ?, ?)')
      .run(businessId, userId, name, address, zone_id || 'ZONE-1');
  });

  const isSecure = process.env.NODE_ENV === 'production' && (req.secure || req.headers['x-forwarded-proto'] === 'https');
  const token = jwt.sign(
    { id: userId, role: 'BUSINESS', name, email },
    jwtSecret(),
    { expiresIn: '1d' }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.status(201).json({ message: 'Registered', id: userId, businessId });
}

export function logoutRoute(req: Request, res: Response) {
  res.clearCookie('token');
  res.clearCookie('csrf');
  res.json({ message: 'Logged out' });
}

export function meRoute(req: Request, res: Response) {
  const payload = req.user ?? null;
  res.json(payload);
}
