import { db } from '../db/index.js';
import { clock } from '../../shared/src/clock.js';

export function getBusinessByOwnerId(ownerId: string) {
  return db.prepare('SELECT id, owner_id, name, address, zone_id, gstin, type, phone, email FROM businesses WHERE owner_id = ?').get(ownerId) as {
    id: string;
    owner_id: string;
    name: string;
    address: string;
    zone_id: string;
    gstin?: string;
    type?: string;
    phone?: string;
    email?: string;
  } | undefined;
}

export function getDashboardKpis(businessId: string) {
  const totalInstruments = (db.prepare('SELECT COUNT(*) as c FROM instruments WHERE business_id = ?').get(businessId) as { c: number }).c;

  const validCertificates = (db.prepare(`
    SELECT COUNT(*) as c 
    FROM certificates c
    JOIN instruments i ON c.instrument_id = i.id
    WHERE i.business_id = ? AND c.status = 'VALID' AND datetime(c.valid_to) > datetime('now')
  `).get(businessId) as { c: number }).c;

  const openApplications = (db.prepare(`
    SELECT COUNT(*) as c 
    FROM applications 
    WHERE business_id = ? AND state NOT IN ('CERTIFIED', 'FAILED', 'CANCELLED')
  `).get(businessId) as { c: number }).c;

  const feesPaid = (db.prepare(`
    SELECT IFNULL(SUM(r.amount), 0) as total 
    FROM receipts r
    JOIN applications a ON r.application_id = a.id
    WHERE a.business_id = ?
  `).get(businessId) as { total: number }).total;

  return {
    totalInstruments,
    validCertificates,
    openApplications,
    feesPaid,
  };
}

export function getOpenApplications(businessId: string) {
  return db.prepare(`
    SELECT 
      a.id,
      a.state,
      a.fee_amount,
      a.created_at,
      i.id as instrument_id,
      i.make as instrument_make,
      i.model as instrument_model,
      i.serial as instrument_serial,
      i.type_code as instrument_class,
      ap.slot_date,
      ap.slot_time,
      ap.status as appointment_status,
      u.name as officer_name
    FROM applications a
    JOIN instruments i ON a.instrument_id = i.id
    LEFT JOIN appointments ap ON a.id = ap.application_id
    LEFT JOIN users u ON ap.officer_id = u.id
    WHERE a.business_id = ? AND a.state NOT IN ('CERTIFIED', 'FAILED', 'CANCELLED')
    ORDER BY a.created_at DESC
  `).all(businessId) as Array<{
    id: string;
    state: string;
    fee_amount: number;
    created_at: string;
    instrument_id: string;
    instrument_make: string;
    instrument_model: string;
    instrument_serial: string;
    instrument_class: string;
    slot_date: string | null;
    slot_time: string | null;
    appointment_status: string | null;
    officer_name: string | null;
  }>;
}

export function getInstrumentsWithStatus(businessId: string) {
  const now = clock.now();
  const rows = db.prepare(`
    SELECT 
      i.id,
      i.type_code,
      i.make,
      i.model,
      i.serial,
      i.capacity,
      i.accuracy_class,
      i.location,
      c.public_id as certificate_public_id,
      c.status as certificate_status,
      c.valid_to,
      (SELECT a.state FROM applications a WHERE a.instrument_id = i.id AND a.state NOT IN ('CERTIFIED', 'FAILED', 'CANCELLED') ORDER BY a.created_at DESC LIMIT 1) as open_app_state
    FROM instruments i
    LEFT JOIN certificates c ON i.id = c.instrument_id
    WHERE i.business_id = ?
    ORDER BY i.id ASC
  `).all(businessId) as Array<{
    id: string;
    type_code: string;
    make: string;
    model: string;
    serial: string;
    capacity: string;
    accuracy_class: string | null;
    location: string | null;
    certificate_public_id: string | null;
    certificate_status: string | null;
    valid_to: string | null;
    open_app_state: string | null;
  }>;

  return rows.map(r => {
    let status: 'CERTIFIED' | 'EXPIRED' | 'PENDING' | 'UNVERIFIED' = 'UNVERIFIED';
    if (r.certificate_status === 'VALID' && r.valid_to && new Date(r.valid_to).getTime() > now) {
      status = 'CERTIFIED';
    } else if (r.certificate_status === 'EXPIRED' || (r.valid_to && new Date(r.valid_to).getTime() <= now)) {
      status = 'EXPIRED';
    } else if (r.open_app_state) {
      status = 'PENDING';
    }

    return {
      id: r.id,
      typeCode: r.type_code,
      make: r.make,
      model: r.model,
      serial: r.serial,
      capacity: r.capacity,
      accuracyClass: r.accuracy_class,
      location: r.location,
      status,
      validUntil: r.valid_to,
      certificatePublicId: r.certificate_public_id,
    };
  });
}

export function getRecentPaymentsForBusiness(businessId: string, limit = 5) {
  return db.prepare(`
    SELECT 
      p.id as payment_id,
      r.id as receipt_id,
      r.application_id,
      r.amount,
      r.created_at,
      i.make || ' ' || i.model as instrument_info,
      i.serial as instrument_serial
    FROM receipts r
    JOIN payments p ON r.payment_id = p.id
    JOIN applications a ON r.application_id = a.id
    JOIN instruments i ON a.instrument_id = i.id
    WHERE a.business_id = ?
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(businessId, limit) as Array<{
    payment_id: string;
    receipt_id: string;
    application_id: string;
    amount: number;
    created_at: string;
    instrument_info: string;
    instrument_serial: string;
  }>;
}

export function getCertificatesForBusiness(businessId: string) {
  return db.prepare(`
    SELECT 
      c.public_id,
      c.valid_from,
      c.valid_to,
      c.status,
      c.public_record,
      i.id as instrument_id,
      i.make || ' ' || i.model as instrument_info,
      i.serial as instrument_serial,
      i.type_code as instrument_class
    FROM certificates c
    JOIN instruments i ON c.instrument_id = i.id
    WHERE i.business_id = ?
    ORDER BY c.created_at DESC
  `).all(businessId) as Array<{
    public_id: string;
    valid_from: string;
    valid_to: string;
    status: string;
    public_record: string;
    instrument_id: string;
    instrument_info: string;
    instrument_serial: string;
    instrument_class: string;
  }>;
}

export function getOfficerDetails(officerId: string) {
  return db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.zone_id, u.daily_capacity, u.gatc_centre_name, z.name as zone_name
    FROM users u
    LEFT JOIN zones z ON u.zone_id = z.id
    WHERE u.id = ?
  `).get(officerId) as {
    id: string;
    name: string;
    email: string;
    role: string;
    zone_id: string | null;
    daily_capacity: number | null;
    gatc_centre_name: string | null;
    zone_name: string | null;
  } | undefined;
}

export function getOfficerDashboardKpis(officerId: string, role: string, todayStr: string) {
  const isGatc = role === 'GATC';

  const awaitingResponse = (db.prepare(`
    SELECT COUNT(*) as c
    FROM appointments ap
    JOIN applications a ON ap.application_id = a.id
    JOIN instruments i ON a.instrument_id = i.id
    WHERE ap.officer_id = ? AND a.state = 'SCHEDULED'
      AND (CASE WHEN ? = 1 THEN i.type_code = 'NAWI-3' ELSE i.type_code != 'NAWI-3' END)
  `).get(officerId, isGatc ? 1 : 0) as { c: number }).c;

  const accepted = (db.prepare(`
    SELECT COUNT(*) as c
    FROM appointments ap
    JOIN applications a ON ap.application_id = a.id
    JOIN instruments i ON a.instrument_id = i.id
    WHERE ap.officer_id = ? AND a.state = 'ACCEPTED'
      AND (CASE WHEN ? = 1 THEN i.type_code = 'NAWI-3' ELSE i.type_code != 'NAWI-3' END)
  `).get(officerId, isGatc ? 1 : 0) as { c: number }).c;

  const todayVisits = (db.prepare(`
    SELECT COUNT(*) as c
    FROM appointments ap
    JOIN applications a ON ap.application_id = a.id
    WHERE ap.officer_id = ? AND ap.slot_date = ? AND a.state IN ('SCHEDULED', 'ACCEPTED')
  `).get(officerId, todayStr) as { c: number }).c;

  const completedMonth = (db.prepare(`
    SELECT COUNT(*) as c
    FROM applications a
    JOIN appointments ap ON a.id = ap.application_id
    WHERE ap.officer_id = ? AND a.state IN ('CERTIFIED', 'INSPECTED_PASS', 'FAILED')
  `).get(officerId) as { c: number }).c;

  const officer = db.prepare('SELECT daily_capacity FROM users WHERE id = ?').get(officerId) as { daily_capacity: number | null } | undefined;
  const limit = officer?.daily_capacity || 8;
  const used = (db.prepare(`
    SELECT COUNT(*) as c
    FROM appointments ap
    JOIN applications a ON ap.application_id = a.id
    WHERE ap.officer_id = ? AND ap.slot_date = ? AND a.state NOT IN ('CANCELLED')
  `).get(officerId, todayStr) as { c: number }).c;

  return {
    awaitingResponse,
    accepted,
    todayVisits,
    completedMonth,
    capacityToday: {
      used,
      limit,
    },
  };
}

export function getOfficerNeedsResponse(officerId: string, role: string) {
  const isGatc = role === 'GATC';
  return db.prepare(`
    SELECT 
      a.id,
      a.state,
      b.name as business_name,
      b.address as business_address,
      b.phone as business_phone,
      z.name as zone_name,
      i.id as instrument_id,
      i.type_code as instrument_class,
      i.serial,
      i.make,
      i.model,
      ap.slot_date,
      ap.slot_time
    FROM appointments ap
    JOIN applications a ON ap.application_id = a.id
    JOIN businesses b ON a.business_id = b.id
    JOIN instruments i ON a.instrument_id = i.id
    LEFT JOIN zones z ON b.zone_id = z.id
    WHERE ap.officer_id = ? AND a.state = 'SCHEDULED'
      AND (CASE WHEN ? = 1 THEN i.type_code = 'NAWI-3' ELSE i.type_code != 'NAWI-3' END)
    ORDER BY ap.slot_date ASC, ap.slot_time ASC
  `).all(officerId, isGatc ? 1 : 0) as Array<{
    id: string;
    state: string;
    business_name: string;
    business_address: string;
    business_phone: string | null;
    zone_name: string | null;
    instrument_id: string;
    instrument_class: string;
    serial: string;
    make: string;
    model: string;
    slot_date: string;
    slot_time: string;
  }>;
}

export function getOfficerTodaySchedule(officerId: string, todayStr: string) {
  return db.prepare(`
    SELECT 
      a.id,
      a.state,
      b.name as business_name,
      b.address as business_address,
      i.id as instrument_id,
      i.type_code as instrument_class,
      i.serial,
      i.make,
      i.model,
      ap.slot_date,
      ap.slot_time
    FROM appointments ap
    JOIN applications a ON ap.application_id = a.id
    JOIN businesses b ON a.business_id = b.id
    JOIN instruments i ON a.instrument_id = i.id
    WHERE ap.officer_id = ? AND ap.slot_date = ?
    ORDER BY ap.slot_time ASC
  `).all(officerId, todayStr) as Array<{
    id: string;
    state: string;
    business_name: string;
    business_address: string;
    instrument_id: string;
    instrument_class: string;
    serial: string;
    make: string;
    model: string;
    slot_date: string;
    slot_time: string;
  }>;
}

export function getOfficerHistory(officerId: string, limit = 5) {
  return db.prepare(`
    SELECT 
      a.id,
      a.state,
      b.name as business_name,
      i.id as instrument_id,
      i.type_code as instrument_class,
      i.serial,
      c.public_id as certificate_public_id,
      c.status as certificate_status,
      ap.slot_date
    FROM applications a
    JOIN appointments ap ON a.id = ap.application_id
    JOIN businesses b ON a.business_id = b.id
    JOIN instruments i ON a.instrument_id = i.id
    LEFT JOIN certificates c ON a.id = c.application_id
    WHERE ap.officer_id = ? AND a.state IN ('CERTIFIED', 'INSPECTED_PASS', 'FAILED')
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(officerId, limit) as Array<{
    id: string;
    state: string;
    business_name: string;
    instrument_id: string;
    instrument_class: string;
    serial: string;
    certificate_public_id: string | null;
    certificate_status: string | null;
    slot_date: string | null;
  }>;
}

export function getAdminDashboardKpis() {
  const applications = (db.prepare('SELECT COUNT(*) as c FROM applications').get() as { c: number }).c;
  const validCertificates = (db.prepare("SELECT COUNT(*) as c FROM certificates WHERE status = 'VALID' AND datetime(valid_to) > datetime('now')").get() as { c: number }).c;
  const feesCollected = (db.prepare("SELECT IFNULL(SUM(amount), 0) as total FROM payments WHERE status = 'PAID'").get() as { total: number }).total;
  const openComplaints = (db.prepare('SELECT COUNT(*) as c FROM certificate_complaints').get() as { c: number }).c;
  const gateBlocks = (db.prepare("SELECT COUNT(*) as c FROM audit_log WHERE action = 'GATE_BLOCKED'").get() as { c: number }).c;

  return {
    applications,
    validCertificates,
    feesCollected,
    openComplaints,
    gateBlocks,
  };
}

export function getApplicationsByState() {
  const rows = db.prepare('SELECT state, COUNT(*) as count FROM applications GROUP BY state').all() as Array<{ state: string; count: number }>;
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  return rows.map(r => ({
    state: r.state,
    count: r.count,
    percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }));
}

export function getAdminComplaintsSummary() {
  const list = db.prepare(`
    SELECT 
      cc.id,
      cc.public_id,
      cc.category,
      cc.note,
      cc.created_at,
      b.name as business_name,
      b.id as business_id
    FROM certificate_complaints cc
    LEFT JOIN certificates c ON cc.public_id = c.public_id
    LEFT JOIN instruments i ON c.instrument_id = i.id
    LEFT JOIN businesses b ON i.business_id = b.id
    ORDER BY cc.created_at DESC
    LIMIT 20
  `).all() as Array<{
    id: number;
    public_id: string;
    category: string;
    note: string;
    created_at: string;
    business_name: string | null;
    business_id: string | null;
  }>;

  const byBusiness = db.prepare(`
    SELECT IFNULL(b.name, 'Unknown Business') as business_name, COUNT(cc.id) as count
    FROM certificate_complaints cc
    LEFT JOIN certificates c ON cc.public_id = c.public_id
    LEFT JOIN instruments i ON c.instrument_id = i.id
    LEFT JOIN businesses b ON i.business_id = b.id
    GROUP BY b.name
    ORDER BY count DESC
  `).all() as Array<{ business_name: string; count: number }>;

  return { list, byBusiness };
}

export function getAdminActivityFeed(limit = 15) {
  const rows = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?').all(limit) as Array<{
    id: string;
    table_name: string;
    record_id: string;
    action: string;
    changed_by: string | null;
    new_data: string | null;
    timestamp: string;
  }>;

  return rows.map(r => {
    let message = '';
    let parsed: Record<string, unknown> | null = null;
    try {
      if (r.new_data && r.new_data.startsWith('{')) {
        parsed = JSON.parse(r.new_data);
      }
    } catch {
      // not json
    }

    if (r.action === 'PAYMENT_RECEIVED') {
      const amount = parsed && typeof parsed.amount === 'number' ? `₹${parsed.amount.toLocaleString('en-IN')}` : '₹100';
      message = `Sandbox payment received, ${r.record_id}, ${amount}`;
    } else if (r.action === 'CERTIFICATE_ISSUED') {
      message = `Certificate issued under Legal Metrology seal, ${r.record_id}`;
    } else if (r.action === 'CERTIFICATE_REVOKED') {
      message = `Certificate revoked by administrator, ${r.record_id}`;
    } else if (r.action === 'GATE_BLOCKED') {
      message = `Fee-gate blocked unauthorized certificate issuance attempt`;
    } else if (r.action === 'ARRIVED') {
      message = `Officer arrival recorded on premises, ${r.record_id}`;
    } else if (r.action === 'SCHEDULED') {
      message = `Verification appointment scheduled for ${r.record_id}`;
    } else if (r.action === 'ACCEPTED') {
      message = `Appointment accepted by officer for ${r.record_id}`;
    } else if (r.action === 'REJECTED') {
      message = `Appointment rejected by officer for ${r.record_id}`;
    } else if (r.action === 'ADMIN_ASSIGNED') {
      message = `Officer manually assigned by administrator for ${r.record_id}`;
    } else if (r.action === 'CREATE' && r.table_name === 'applications') {
      message = `New application submitted, ${r.record_id}`;
    } else if (r.action === 'CREATE' && r.table_name === 'instruments') {
      message = `New instrument registered, ${r.record_id}`;
    } else if (r.action === 'PROVISION_OFFICER') {
      message = `New officer account provisioned by administrator`;
    } else {
      message = `Action ${r.action.toLowerCase().replace(/_/g, ' ')} on ${r.table_name} (${r.record_id})`;
    }

    return {
      id: r.id,
      action: r.action,
      message,
      timestamp: r.timestamp,
    };
  });
}
