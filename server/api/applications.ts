import { Request, Response } from 'express';
import { z } from 'zod';
import { createApplicationService, listApplicationsService, getApplicationService } from '../services/applicationsService.js';

const appSchema = z.object({
  instrument_id: z.string().min(1),
  documents: z.array(z.object({
    doc_type: z.string().min(1),
    file_name: z.string().min(1),
    file_hash: z.string().min(1)
  })).min(1)
});

export function createApplication(req: Request, res: Response) {
  const parse = appSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: 'Validation failed', errors: parse.error.errors });
  
  try {
    const result = createApplicationService(req.user, parse.data);
    res.status(201).json({ id: result.id, message: 'Application submitted', fee_amount: result.fee_amount, routingRule: result.routingRule });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Forbidden') return res.status(403).json({ message: 'Forbidden' });
    if (error.message === 'Business profile not found') return res.status(403).json({ message: 'Business profile not found' });
    if (error.message === 'Instrument not found or does not belong to you') return res.status(403).json({ message: error.message });
    if (error.message === 'Pending application already exists for this instrument') return res.status(409).json({ message: error.message });
    throw err;
  }
}

export function listApplications(req: Request, res: Response) {
  const state = req.query.state as string | undefined;
  const apps = listApplicationsService(req.user, state);
  res.json(apps);
}

export function getApplication(req: Request, res: Response) {
  try {
    const app = getApplicationService(req.user, req.params.id);
    res.json(app);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Not found') return res.status(404).json({ message: 'Not found' });
    if (error.message === 'Forbidden') return res.status(403).json({ message: 'Forbidden' });
    throw err;
  }
}
