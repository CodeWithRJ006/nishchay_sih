import { Request, Response } from 'express';
import { 
  getBusinessDashboardData,
  getOfficerDashboardData,
  getAdminDashboardData 
} from '../services/dashboardService.js';
import { getAdminComplaintsSummary, getAdminActivityFeed } from '../repositories/dashboardRepo.js';

export function getBusinessDashboard(req: Request, res: Response) {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user || user.role !== 'BUSINESS') {
    return res.status(403).json({ error: 'Business access required' });
  }

  const data = getBusinessDashboardData(user.id);
  res.json(data);
}

export function getOfficerDashboard(req: Request, res: Response) {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user || (user.role !== 'LMO' && user.role !== 'GATC')) {
    return res.status(403).json({ error: 'Officer access required' });
  }

  try {
    const data = getOfficerDashboardData(user.id);
    res.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    if (error.message === 'Officer not found') {
      return res.status(404).json({ error: error.message });
    }
    throw err;
  }
}

export function getAdminDashboard(req: Request, res: Response) {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const data = getAdminDashboardData();
  res.json(data);
}

export function getAdminComplaints(req: Request, res: Response) {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const complaints = getAdminComplaintsSummary();
  res.json(complaints);
}

export function getAdminActivity(req: Request, res: Response) {
  const user = req.user as { id: string; role: string } | undefined;
  if (!user || user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const feed = getAdminActivityFeed(20);
  res.json(feed);
}
