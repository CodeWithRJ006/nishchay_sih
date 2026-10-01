import { Request, Response } from 'express';
import { z } from 'zod';
import { 
  getAvailableSlots, 
  scheduleAppointment, 
  acceptAppointment, 
  rejectAppointment,
  adminAssign
} from '../services/appointmentsService.js';
import { getJobsForOfficer, getUnassignedJobs, getAllOfficers } from '../repositories/appointmentsRepo.js';

export function getSlots(req: Request, res: Response) {
  res.json(getAvailableSlots());
}

export function schedule(req: Request, res: Response) {
  const schema = z.object({
    applicationId: z.string(),
    slotDate: z.string(),
    slotTime: z.string()
  });
  
  const data = schema.parse(req.body);
  try {
    const result = scheduleAppointment(data.applicationId, data.slotDate, data.slotTime, req.user!.id);
    res.json(result);
  } catch (e) {
    const err = e as Error;
    if (err.message.includes('Invalid transition')) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export function accept(req: Request, res: Response) {
  const schema = z.object({ applicationId: z.string() });
  const data = schema.parse(req.body);
  try {
    acceptAppointment(data.applicationId, req.user!.id);
    res.json({ success: true });
  } catch (e) {
    const err = e as Error;
    if (err.message.includes('Forbidden')) return res.status(403).json({ error: err.message });
    if (err.message.includes('Conflict') || err.message.includes('Invalid transition')) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export function reject(req: Request, res: Response) {
  const schema = z.object({ 
    applicationId: z.string(),
    reason: z.string().min(1)
  });
  const data = schema.parse(req.body);
  try {
    rejectAppointment(data.applicationId, req.user!.id, data.reason);
    res.json({ success: true });
  } catch (e) {
    const err = e as Error;
    if (err.message.includes('Forbidden')) return res.status(403).json({ error: err.message });
    if (err.message.includes('Conflict') || err.message.includes('Invalid transition')) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export function getMyJobs(req: Request, res: Response) {
  if (req.user?.role !== 'LMO' && req.user?.role !== 'GATC') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const jobs = getJobsForOfficer(req.user.id);
  res.json(jobs);
}

export function listUnassigned(req: Request, res: Response) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const jobs = getUnassignedJobs();
  res.json(jobs);
}

export function assignManually(req: Request, res: Response) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const schema = z.object({
    applicationId: z.string(),
    officerId: z.string()
  });
  const data = schema.parse(req.body);
  try {
    adminAssign(data.applicationId, data.officerId, req.user.id);
    res.json({ success: true });
  } catch (e) {
    const err = e as Error;
    if (err.message.includes('Conflict') || err.message.includes('Invalid transition')) return res.status(409).json({ error: err.message });
    throw err;
  }
}

export function listOfficers(req: Request, res: Response) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
  const officers = getAllOfficers();
  res.json(officers);
}
