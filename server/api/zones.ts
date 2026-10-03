import { Request, Response } from 'express';
import { listZones } from '../services/zonesService.js';

export function getZones(_req: Request, res: Response) {
  const zones = listZones();
  res.json(zones);
}
