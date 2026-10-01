import { db } from '../db/index.js';

export function getEligibleOfficer(routingRule: string, zoneId: string | null, slotDate: string, applicationId: string) {
  const role = routingRule === 'LMO' ? 'LMO' : 'GATC';

  // Find officers with correct role, matching zone, who haven't rejected this app, 
  // and have fewer appointments on this date than their daily_capacity.
  // Sort by fewer appointments first, then by user id.
  
  const query = `
    SELECT u.id, u.daily_capacity,
           (SELECT COUNT(*) FROM appointments a2 WHERE a2.officer_id = u.id AND a2.slot_date = ?) as current_load
    FROM users u
    WHERE u.role = ?
      AND (u.zone_id = ? OR u.zone_id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM officer_rejections r WHERE r.officer_id = u.id AND r.application_id = ?)
    GROUP BY u.id
    HAVING current_load < IFNULL(u.daily_capacity, 5)
    ORDER BY current_load ASC, u.id ASC
    LIMIT 1
  `;

  return db.prepare(query).get(slotDate, role, zoneId, applicationId) as { id: string } | undefined;
}

export function createAppointment(applicationId: string, officerId: string, slotDate: string, slotTime: string) {
  db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time) VALUES (hex(randomblob(8)), ?, ?, ?, ?)')
    .run(applicationId, officerId, slotDate, slotTime);
}

export function deleteAppointment(applicationId: string) {
  db.prepare('DELETE FROM appointments WHERE application_id = ?').run(applicationId);
}

export function getAppointmentForApp(applicationId: string) {
  return db.prepare('SELECT * FROM appointments WHERE application_id = ?').get(applicationId) as { officer_id: string | null, slot_date: string, slot_time: string, status: string } | undefined;
}

export function recordRejection(applicationId: string, officerId: string, reason: string) {
  db.prepare('INSERT INTO officer_rejections (application_id, officer_id, reason) VALUES (?, ?, ?)')
    .run(applicationId, officerId, reason);
}

export function updateAppointmentStatus(applicationId: string, status: string) {
  db.prepare('UPDATE appointments SET status = ? WHERE application_id = ?').run(status, applicationId);
}

export function getJobsForOfficer(officerId: string) {
  return db.prepare(`
    SELECT a.*, app.state, app.instrument_id, biz.name as business_name, biz.address, biz.lat, biz.lng
    FROM appointments a
    JOIN applications app ON a.application_id = app.id
    JOIN businesses biz ON app.business_id = biz.id
    WHERE a.officer_id = ?
    ORDER BY a.slot_date ASC
  `).all(officerId);
}

export function getUnassignedJobs() {
  return db.prepare(`
    SELECT app.*, biz.name as business_name, biz.zone_id, a.slot_date, a.slot_time
    FROM applications app
    JOIN businesses biz ON app.business_id = biz.id
    JOIN appointments a ON a.application_id = app.id
    WHERE app.state = 'PAID' AND a.officer_id IS NULL
  `).all();
}

export function getAllOfficers() {
  return db.prepare('SELECT id, name, role, zone_id, daily_capacity FROM users WHERE role IN ("LMO", "GATC")').all();
}

export function recordAudit(applicationId: string, userId: string, action: string, details: string) {
  db.prepare('INSERT INTO audit_log (id, table_name, record_id, action, changed_by, new_data) VALUES (hex(randomblob(8)), ?, ?, ?, ?, ?)')
    .run('applications', applicationId, action, userId, details);
}
