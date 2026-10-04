import { Request, Response } from 'express';
import { db } from '../db/index.js';
import { recordAudit } from '../repositories/appointmentsRepo.js';
import { haversine } from '../../shared/src/haversine.js';

export function arriveAtJob(req: Request, res: Response) {
  const { id } = req.params; // application_id
  const userId = req.user!.id;
  
  // Verify it's ACCEPTED
  const app = db.prepare('SELECT state, business_id FROM applications WHERE id = ?').get(id) as { state: string; business_id: string } | undefined;
  if (!app) return res.status(404).json({ error: 'Not found' });
  
  if (app.state !== 'ACCEPTED') {
    return res.status(409).json({ error: 'Application must be ACCEPTED to arrive' });
  }

  const appointment = db.prepare('SELECT status FROM appointments WHERE application_id = ? AND officer_id = ?').get(id, userId) as { status: string } | undefined;
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
  
  if (appointment.status !== 'ACCEPTED') {
    return res.status(409).json({ error: 'Appointment must be ACCEPTED to arrive' });
  }

  // Get business target coordinates
  const biz = db.prepare('SELECT lat, lng, address FROM businesses WHERE id = ?').get(app.business_id) as { lat: number | null; lng: number | null; address: string } | undefined;
  const targetLat = (biz?.lat !== null && biz?.lat !== undefined && biz.lat !== 0) ? biz.lat : 17.3850;
  const targetLng = (biz?.lng !== null && biz?.lng !== undefined && biz.lng !== 0) ? biz.lng : 78.4867;

  const rawBody = req.body || {};
  const isDemo = Boolean(rawBody.is_demo_location || rawBody.isDemoLocation || rawBody.overrideMode);
  const inputLat = rawBody.lat ?? rawBody.gps_lat;
  const inputLng = rawBody.lng ?? rawBody.gps_lng;

  let arrivedLat: number;
  let arrivedLng: number;
  let arrivedDistance: number;
  let isDemoLocation: number;

  if (isDemo) {
    arrivedLat = targetLat;
    arrivedLng = targetLng;
    arrivedDistance = 12.0; // Realistic 12m for demo as required
    isDemoLocation = 1;
  } else if (typeof inputLat === 'number' && typeof inputLng === 'number' && Number.isFinite(inputLat) && Number.isFinite(inputLng)) {
    arrivedLat = inputLat;
    arrivedLng = inputLng;
    arrivedDistance = Math.round(haversine(inputLat, inputLng, targetLat, targetLng) * 10) / 10;
    isDemoLocation = 0;
  } else {
    // Default fallback in demo mode or test
    arrivedLat = targetLat;
    arrivedLng = targetLng;
    arrivedDistance = 12.0;
    isDemoLocation = 1;
  }

  // Transaction to update and log
  const arrive = db.transaction(() => {
    db.prepare(`
      UPDATE appointments 
      SET status = 'ARRIVED',
          arrived_lat = ?,
          arrived_lng = ?,
          arrived_distance = ?,
          is_demo_location = ?
      WHERE application_id = ?
    `).run(arrivedLat, arrivedLng, arrivedDistance, isDemoLocation, id);

    recordAudit(id, userId, 'ARRIVED', JSON.stringify({
      arrived_lat: arrivedLat,
      arrived_lng: arrivedLng,
      arrived_distance: arrivedDistance,
      is_demo_location: isDemoLocation
    }));
  });

  arrive();
  res.json({
    success: true,
    arrived_lat: arrivedLat,
    arrived_lng: arrivedLng,
    arrived_distance: arrivedDistance,
    is_demo_location: Boolean(isDemoLocation)
  });
}
