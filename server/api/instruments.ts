import { Request, Response } from 'express';
import { z } from 'zod';
import { registerInstrumentService, listInstrumentsService, getInstrumentService } from '../services/instrumentsService.js';

const instrumentSchema = z.object({
  type_code: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  capacity: z.string().min(1),
  serial: z.string().min(1),
  accuracy_class: z.string().optional(),
  location: z.string().optional()
});

export function registerInstrument(req: Request, res: Response) {
  const parse = instrumentSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: 'Validation failed', errors: parse.error.errors });

  try {
    const id = registerInstrumentService(req.user, parse.data);
    res.status(201).json({ id, message: 'Instrument registered' });
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Forbidden') return res.status(403).json({ message: 'Forbidden' });
    if (error.message === 'Business profile not found') return res.status(403).json({ message: 'Business profile not found' });
    throw err; // Let global handler map SQLITE_CONSTRAINT_UNIQUE
  }
}

export function listInstruments(req: Request, res: Response) {
  try {
    const instruments = listInstrumentsService(req.user);
    res.json(instruments);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Forbidden') return res.status(403).json({ message: 'Forbidden' });
    throw err;
  }
}

export function getInstrument(req: Request, res: Response) {
  try {
    const instrument = getInstrumentService(req.user, req.params.id);
    res.json(instrument);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Not found') return res.status(404).json({ message: 'Not found' });
    if (error.message === 'Forbidden') return res.status(403).json({ message: 'Forbidden' });
    throw err;
  }
}
