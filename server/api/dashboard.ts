import { Request, Response } from 'express';
import { getBusinessDashboardData } from '../services/dashboardService.js';

export function getBusinessDashboard(req: Request, res: Response) {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user || user.role !== 'BUSINESS') {
    return res.status(403).json({ error: 'Business access required' });
  }

  const data = getBusinessDashboardData(user.id);
  res.json(data);
}
