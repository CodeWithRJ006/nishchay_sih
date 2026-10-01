import { db, transaction } from '../db/index.js';
import { clock } from '../../shared/src/clock.js';
import { transition, State } from '../../shared/src/stateMachine.js';
import { findApplicationById } from '../repositories/applicationsRepo.js';
import { 
  getEligibleOfficer, 
  createAppointment, 
  deleteAppointment,
  getAppointmentForApp,
  recordRejection,
  updateAppointmentStatus,
  recordAudit
} from '../repositories/appointmentsRepo.js';

function getNextWorkingDays(numDays: number) {
  // Asia/Kolkata Mon-Sat
  const days: { date: string, slots: string[] }[] = [];
  const now = new Date(clock.now());
  now.setUTCHours(now.getUTCHours() + 5);
  now.setUTCMinutes(now.getUTCMinutes() + 30);
  
  const current = new Date(now);
  while (days.length < numDays) {
    current.setUTCDate(current.getUTCDate() + 1);
    const dayOfWeek = current.getUTCDay();
    if (dayOfWeek !== 0) { // Not Sunday
      const dateStr = current.toISOString().split('T')[0];
      days.push({ date: dateStr, slots: ['MORNING', 'AFTERNOON', 'EVENING'] });
    }
  }
  return days;
}

export function getAvailableSlots() {
  return getNextWorkingDays(10);
}

export function scheduleAppointment(applicationId: string, slotDate: string, slotTime: string, userId: string) {
  return transaction(() => {
    const app = findApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    
    // Check PAID state via transition (will throw if not PAID)
    const newState = transition(app.state as State, { type: 'schedule' });
    
    // Find zone
    const biz = db.prepare('SELECT zone_id FROM businesses WHERE id = ?').get(app.business_id) as { zone_id: string };
    const role = (app.routing_rule as string).includes('GATC') ? 'GATC' : 'LMO';
    
    const officer = getEligibleOfficer(role, biz.zone_id, slotDate, applicationId);
    
    if (officer) {
      // Auto-assign
      createAppointment(applicationId, officer.id, slotDate, slotTime);
      db.prepare('UPDATE applications SET state = ? WHERE id = ?').run(newState, applicationId);
      recordAudit(applicationId, userId, 'SCHEDULED', `Auto-assigned to ${officer.id}`);
      return { status: 'SCHEDULED', officer_id: officer.id };
    } else {
      // No eligible officer found. We don't change state. Stay PAID. Admin manual queue.
      recordAudit(applicationId, userId, 'NO_OFFICER_AVAILABLE', `No officer found for slot ${slotDate}`);
      // The prompt says "otherwise it stays PAID and appears in the admin 'Unassigned' queue."
      // BUT if this is the FIRST time it's scheduled from business... wait.
      // "scheduling is rejected unless the application is PAID. ... try another eligible officer... if found SCHEDULED, otherwise stays PAID".
      // Let's just keep it PAID if no officer is found during initial schedule too? 
      // Yes, if it stays PAID it's in the unassigned queue.
      // Let's explicitly save the slot info somewhere or just leave it empty. 
      // The prompt says "The business picks a slot... admin can assign manually".
      // If the admin assigns manually, they need the slot date. We will store it in appointments with NULL officer for now.
      db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (hex(randomblob(8)), ?, NULL, ?, ?, ?)')
        .run(applicationId, slotDate, slotTime, 'SCHEDULED');
      return { status: 'UNASSIGNED', message: 'No officer available, queued for admin' };
    }
  });
}

export function acceptAppointment(applicationId: string, officerId: string) {
  return transaction(() => {
    const app = findApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    
    const appointment = getAppointmentForApp(applicationId);
    if (!appointment || appointment.officer_id !== officerId) {
      // Create a specific 403 error logic in the handler for this.
      throw new Error('Forbidden: Not your assignment');
    }
    if (appointment.status === 'ACCEPTED') {
      throw new Error('Conflict: Already accepted');
    }

    const newState = transition(app.state as State, { type: 'officer_accept' });
    updateAppointmentStatus(applicationId, 'ACCEPTED');
    db.prepare('UPDATE applications SET state = ? WHERE id = ?').run(newState, applicationId);
    recordAudit(applicationId, officerId, 'ACCEPTED', 'Officer accepted assignment');
  });
}

export function rejectAppointment(applicationId: string, officerId: string, reason: string) {
  return transaction(() => {
    const app = findApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    
    const appointment = getAppointmentForApp(applicationId);
    if (!appointment || appointment.officer_id !== officerId) {
      throw new Error('Forbidden: Not your assignment');
    }

    // transition to PAID
    let newState = transition(app.state as State, { type: 'officer_reject', reason });
    db.prepare('UPDATE applications SET state = ? WHERE id = ?').run(newState, applicationId);
    
    recordRejection(applicationId, officerId, reason);
    recordAudit(applicationId, officerId, 'REJECTED', reason);
    
    const slotDate = appointment.slot_date;
    const slotTime = appointment.slot_time;
    
    // Remove appointment
    deleteAppointment(applicationId);
    
    // Try reassigning
    const biz = db.prepare('SELECT zone_id FROM businesses WHERE id = ?').get(app.business_id) as { zone_id: string };
    const role = (app.routing_rule as string).includes('GATC') ? 'GATC' : 'LMO';
    
    const newOfficer = getEligibleOfficer(role, biz.zone_id, slotDate, applicationId);
    
    if (newOfficer) {
      newState = transition(newState as State, { type: 'schedule' });
      createAppointment(applicationId, newOfficer.id, slotDate, slotTime);
      db.prepare('UPDATE applications SET state = ? WHERE id = ?').run(newState, applicationId);
      recordAudit(applicationId, 'SYSTEM', 'SCHEDULED', `Reassigned to ${newOfficer.id}`);
    } else {
      // Stays PAID, put in unassigned queue (appointment with NULL officer)
      db.prepare('INSERT INTO appointments (id, application_id, officer_id, slot_date, slot_time, status) VALUES (hex(randomblob(8)), ?, NULL, ?, ?, ?)')
        .run(applicationId, slotDate, slotTime, 'SCHEDULED');
    }
  });
}

export function adminAssign(applicationId: string, officerId: string, adminId: string) {
  return transaction(() => {
    const app = findApplicationById(applicationId);
    if (!app) throw new Error('Application not found');
    
    if (app.state !== 'PAID') {
      throw new Error('Conflict: Application is not in PAID state');
    }
    
    const appointment = getAppointmentForApp(applicationId);
    if (!appointment) throw new Error('No unassigned slot found for application');
    if (appointment.officer_id) throw new Error('Conflict: Already assigned');
    
    const newState = transition(app.state as State, { type: 'schedule' });
    
    // Update appointment
    db.prepare('UPDATE appointments SET officer_id = ? WHERE application_id = ?').run(officerId, applicationId);
    db.prepare('UPDATE applications SET state = ? WHERE id = ?').run(newState, applicationId);
    
    recordAudit(applicationId, adminId, 'ADMIN_ASSIGNED', `Admin manually assigned to ${officerId}`);
  });
}
