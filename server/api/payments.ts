import { Request, Response } from 'express';
import { z } from 'zod';
import { initiatePaymentService, paymentCallbackService } from '../services/paymentsService.js';
import { getAllPayments, getAllReceipts, getGateBlocksCount } from '../repositories/paymentsRepo.js';

export function initiatePayment(req: Request, res: Response) {
  const schema = z.object({
    applicationId: z.string(),
    amount: z.number().int().nonnegative()
  });
  const data = schema.parse(req.body);
  const result = initiatePaymentService(req.user, data.applicationId, data.amount);
  res.status(200).json(result);
}

export function paymentCallback(req: Request, res: Response) {
  const schema = z.object({
    paymentId: z.string(),
    status: z.enum(['SUCCESS', 'FAILURE', 'PENDING']),
    amount: z.number().int().nonnegative(),
    timestamp: z.number(),
    applicationId: z.string()
  });
  
  const signature = req.headers['x-hmac-signature'];
  if (typeof signature !== 'string') {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing signature' });
  }

  const data = schema.parse(req.body);
  try {
    const result = paymentCallbackService(data, signature);
    res.status(200).json(result);
  } catch (err: unknown) {
    const error = err as Error & { status?: number; code?: string };
    const status = error.status || 500;
    res.status(status).json({
      code: error.code || 'PAYMENT_CALLBACK_ERROR',
      message: error.message
    });
  }
}

export function listPayments(req: Request, res: Response) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  const data = getAllPayments();
  res.json(data);
}

export function listReceipts(req: Request, res: Response) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  const data = getAllReceipts();
  res.json(data);
}

export function gateBlocks(req: Request, res: Response) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  const data = getGateBlocksCount();
  res.json(data);
}
