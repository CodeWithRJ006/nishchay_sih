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
import { getBusinessProfile, updateBusinessProfile, getOfficerProfile, provisionOfficer } from './api/profiles.js';
import { registerInstrument, listInstruments, getInstrument } from './api/instruments.js';
import { uploadMiddleware, handleUpload, downloadDocument } from './api/uploads.js';
import { createApplication, listApplications, getApplication } from './api/applications.js';
import { initiatePayment, paymentCallback, listPayments, listReceipts, gateBlocks } from './api/payments.js';
import { getSlots, schedule, accept, reject, getMyJobs, listUnassigned, assignManually, listOfficers } from './api/appointments.js';
import { arriveAtJob } from './api/field.js';
import { submitInspection } from './api/fieldInspection.js';
import { uploadMultipleMiddleware } from './api/uploads.js';
import { certificateRoutes } from './api/certificates.js';
import { demoRoutes } from './api/demo.js';

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
  app.get('/api/business/profile', getBusinessProfile);
  app.put('/api/business/profile', updateBusinessProfile);
  app.get('/api/officer/profile', getOfficerProfile);
  app.post('/api/admin/provision', provisionOfficer);

  // Block 4b Routes
  app.post('/api/instruments', registerInstrument);
  app.get('/api/instruments', listInstruments);
  app.get('/api/instruments/:id', getInstrument);
  
  app.post('/api/upload', uploadMiddleware, handleUpload);
  app.get('/api/documents/:fileName', downloadDocument);
  
  app.post('/api/applications', createApplication);
  app.get('/api/applications', listApplications);
  app.get('/api/applications/:id', getApplication);

  app.post('/api/payments/initiate', initiatePayment);
  app.post('/api/payments/callback', paymentCallback);
  app.get('/api/admin/payments', listPayments);
  app.get('/api/admin/receipts', listReceipts);
  app.get('/api/admin/gate-blocks', gateBlocks);

  app.get('/api/appointments/slots', getSlots);
  app.post('/api/appointments/schedule', schedule);
  app.post('/api/appointments/accept', accept);
  app.post('/api/appointments/reject', reject);
  app.get('/api/appointments/my-jobs', getMyJobs);
  app.get('/api/admin/unassigned-jobs', listUnassigned);
  app.post('/api/admin/assign', assignManually);
  app.get('/api/admin/officers', listOfficers);

  app.post('/api/field/jobs/:id/arrive', arriveAtJob);
  app.post('/api/field/jobs/:id/inspection', uploadMultipleMiddleware, submitInspection);

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

  app.post('/api/demo/trigger-callback', async (req, res) => {
    if (process.env.DEMO_MODE !== 'true') return res.status(404).send();
    const crypto = await import('node:crypto');
    const body = req.body;
    const hmac = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'dev-hmac-secret');
    hmac.update(`${body.paymentId}:${body.status}:${body.amount}:${body.timestamp}:${body.applicationId}`);
    const signature = hmac.digest('hex');
    
    // forward to local callback
    fetch(`http://127.0.0.1:${process.env.PORT || 4000}/api/payments/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hmac-signature': signature
      },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(data => res.json(data)).catch(e => res.status(500).json({ error: e.message }));
  });
// Register Block 9 certificate routes
certificateRoutes.forEach(r => (app as unknown as Record<string, (...args: unknown[]) => unknown>)[r.method.toLowerCase()](r.path, ...r.handler));
// Register Block 10 demo routes (handlers already check DEMO_MODE)
demoRoutes.forEach(r => (app as unknown as Record<string, (...args: unknown[]) => unknown>)[r.method.toLowerCase()](r.path, ...r.handler));

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

  app.use((err: Error & { code?: string }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = req.id;
    if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        code: 'CONFLICT',
        message: 'A duplicate record already exists.',
        requestId
      });
    }
    logger.error({ err, requestId }, 'Unhandled error');
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      requestId
    });
  });

  return app;
}
