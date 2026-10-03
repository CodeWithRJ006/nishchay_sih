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
