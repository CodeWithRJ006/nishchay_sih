import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { db } from './db/index.js';
import { authMiddleware, csrfMiddleware, loginRoute, registerRoute, logoutRoute, meRoute } from './auth/index.js';
import { rbacMiddleware } from './rbac/routeTable.js';

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
        fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    }
  }));

  app.use(pinoHttp({
    logger,
    genReqId: () => randomUUID()
  }));

  app.use(express.json());
  app.use(cookieParser());

  app.use(authMiddleware);
  
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use(csrfMiddleware);
  
  // Exclude some static routes from RBAC or list them in table
  app.use(rbacMiddleware);

  app.post('/api/auth/register', registerRoute);
  app.post('/api/auth/login', loginRoute);
  app.post('/api/auth/logout', logoutRoute);
  app.get('/api/auth/me', meRoute);

  app.post('/api/demo/login-as/:role', (req, res) => {
    if (process.env.DEMO_MODE !== 'true') return res.status(404).send();
    // Helper to log in directly via seed
    const role = req.params.role;
    const user = db.prepare('SELECT id, email, role, name FROM users WHERE role = ? LIMIT 1').get(role) as Record<string, unknown>;
    if (!user) return res.status(404).json({ error: 'Role not found' });
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '1d' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json(user);
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
      } else {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Not Found', requestId: req.id });
      }
    });
  }

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = req.id;
    logger.error({ err, requestId }, 'Unhandled error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      requestId
    });
  });

  return app;
}
