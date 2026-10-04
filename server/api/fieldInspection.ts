import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { recordAudit } from '../repositories/appointmentsRepo.js';
import { transition } from '../../shared/src/stateMachine.js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { INSTRUMENT_RULES, evaluateReadings } from '../../shared/src/rules.js';
import { storageDir } from '../config/paths.js';
import { CertificateService } from '../services/certificateService.js';

const readingItemSchema = z.object({
  applied: z.number().finite({ message: 'Applied reading must be a finite number' }),
  observed: z.number().finite({ message: 'Observed reading must be a finite number' })
});

const readingsArraySchema = z.array(readingItemSchema).min(3, { message: 'At least 3 readings are required' });

export async function submitInspection(req: Request, res: Response) {
  const { id } = req.params; // application_id
  const userId = req.user!.id;
  
  const app = db.prepare('SELECT state, instrument_id FROM applications WHERE id = ?').get(id) as { state: string; instrument_id: string } | undefined;
  if (!app) return res.status(404).json({ error: 'Application not found' });
  
  if (app.state !== 'ACCEPTED') {
    return res.status(409).json({ error: 'Application must be ACCEPTED' });
  }

  const appointment = db.prepare(`
    SELECT status, arrived_lat, arrived_lng, arrived_distance 
    FROM appointments 
    WHERE application_id = ? AND officer_id = ?
  `).get(id, userId) as {
    status: string;
    arrived_lat: number | null;
    arrived_lng: number | null;
    arrived_distance: number | null;
  } | undefined;

  if (!appointment || appointment.status !== 'ARRIVED') {
    return res.status(409).json({ error: 'Officer must have ARRIVED' });
  }

  // Parse JSON fields from form data
  let rawChecklist: unknown;
  let rawReadings: unknown;
  let pass: boolean;
  let reasons: string[];
  let clientCaptureTimes: string[];
  let clientHashes: string[];

  try {
    rawChecklist = JSON.parse(req.body.checklist);
    rawReadings = JSON.parse(req.body.readings);
    pass = JSON.parse(req.body.pass);
    reasons = JSON.parse(req.body.reasons || '[]');
    clientCaptureTimes = JSON.parse(req.body.clientCaptureTimes || '[]');
    clientHashes = JSON.parse(req.body.clientHashes || '[]');
  } catch {
    return res.status(400).json({ error: 'Invalid JSON in fields' });
  }

  if (!pass && reasons.length === 0) {
    return res.status(400).json({ error: 'FAIL requires at least one reason' });
  }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length < 2) {
    return res.status(400).json({ error: 'At least 2 photos are required' });
  }

  const photoRecords: { file_name: string; file_hash: string; client_capture_time: string; server_receive_time: string; buffer: Buffer }[] = [];
  const serverReceiveTime = new Date().toISOString();

  // Validate and hash files
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // check magic bytes for JPEG or PNG
    const buffer = file.buffer;
    const isJpeg = buffer.length > 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
    const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    if (!isJpeg && !isPng) {
      return res.status(400).json({ error: 'Only JPEG or PNG allowed' });
    }
    
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 5MB' });
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hash !== clientHashes[i]) {
      return res.status(400).json({ error: 'Hash mismatch' });
    }

    const ext = isJpeg ? '.jpg' : '.png';
    const fileName = crypto.randomBytes(16).toString('hex') + ext;
    
    photoRecords.push({
      file_name: fileName,
      file_hash: hash,
      client_capture_time: clientCaptureTimes[i],
      server_receive_time: serverReceiveTime,
      buffer
    });
  }

  // Validate readings with Zod
  const readingsParseResult = readingsArraySchema.safeParse(rawReadings);
  if (!readingsParseResult.success) {
    return res.status(400).json({ error: readingsParseResult.error.errors[0]?.message || 'Invalid readings' });
  }
  const readings = readingsParseResult.data;

  // Plausible range validation: non-negative and realistic scale (e.g., up to 500,000)
  for (const r of readings) {
    if (r.applied <= 0 || r.observed < 0) {
      return res.status(400).json({ error: 'Readings must be positive numbers' });
    }
    if (r.applied > 500000 || r.observed > 500000) {
      return res.status(400).json({ error: 'Readings exceed plausible measurement range' });
    }
  }

  const instrumentRow = db.prepare('SELECT type_code FROM instruments WHERE id = ?').get(app.instrument_id) as { type_code: string } | undefined;
  if (!instrumentRow) return res.status(404).json({ error: 'Instrument not found' });

  // Validate checklist: all required items must be checked/true
  const rule = INSTRUMENT_RULES.find(r => r.code === instrumentRow.type_code);
  if (!Array.isArray(rawChecklist)) {
    return res.status(400).json({ error: 'Checklist must be an array' });
  }

  let checklistValid = false;
  if (rule) {
    if (rawChecklist.every(item => typeof item === 'boolean')) {
      checklistValid = rawChecklist.length >= rule.checklistDemo.length && rawChecklist.every(item => item === true);
    } else if (rawChecklist.every(item => typeof item === 'object' && item !== null)) {
      const typedItems = rawChecklist as Record<string, unknown>[];
      checklistValid = typedItems.length >= 1 && typedItems.every(item => item.ok === true || item.checked === true);
    } else if (rawChecklist.every(item => typeof item === 'string')) {
      checklistValid = rawChecklist.length >= rule.checklistDemo.length;
    }
  } else {
    checklistValid = rawChecklist.length > 0;
  }

  if (!checklistValid) {
    return res.status(400).json({ error: 'All checklist items must be verified' });
  }

  const evaluated = evaluateReadings(instrumentRow.type_code, readings);
  if (!evaluated.pass && pass && reasons.length === 0) {
    return res.status(400).json({ error: 'PASS override requires a reason' });
  }

  const gpsLat = appointment.arrived_lat ?? 17.3850;
  const gpsLng = appointment.arrived_lng ?? 78.4867;
  const gpsDistance = appointment.arrived_distance ?? 12.0;

  const certificateService = new CertificateService();
  const dir = storageDir();
  let certificateId: string | null = null;

  // Single atomic database transaction:
  // inspection save + application state transition (ACCEPTED -> INSPECTED_PASS) + certificate issuance
  const atomicInspection = db.transaction(() => {
    // 1. Insert inspection
    db.prepare(`
      INSERT INTO inspections (id, application_id, officer_id, gps_lat, gps_lng, gps_distance, checklist, readings, pass, reasons)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'INS-' + crypto.randomBytes(4).toString('hex'), 
      id, 
      userId, 
      gpsLat, 
      gpsLng, 
      gpsDistance,
      JSON.stringify(rawChecklist), 
      JSON.stringify(readings), 
      pass ? 1 : 0, 
      JSON.stringify(reasons)
    );

    // 2. Insert photos
    const insertPhoto = db.prepare(`
      INSERT INTO inspection_photos (id, application_id, uploader_id, file_name, file_hash, client_capture_time, server_receive_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of photoRecords) {
      insertPhoto.run('PHO-' + crypto.randomBytes(4).toString('hex'), id, userId, p.file_name, p.file_hash, p.client_capture_time, p.server_receive_time);
    }

    // 3. State transition
    const ev = pass ? { type: 'inspection_pass' as const } : { type: 'inspection_fail' as const, reasons };
    const newState = transition(app.state as import('../../shared/src/stateMachine.js').State, ev);
    db.prepare('UPDATE applications SET state = ? WHERE id = ?').run(newState, id);

    // 4. Audit log
    recordAudit(id, userId, pass ? 'INSPECTED_PASS' : 'FAILED', JSON.stringify({ reasons }));

    // 5. If pass, issue certificate INSIDE this exact transaction
    if (pass) {
      certificateId = certificateService.issueCertificateSync(id, userId);
    }
  });

  try {
    atomicInspection();

    // Write photo files to disk only after transaction commits successfully
    for (const p of photoRecords) {
      fs.writeFileSync(path.join(dir, p.file_name), p.buffer);
    }

    if (pass) {
      return res.json({ success: true, certificateId });
    }
    return res.json({ success: true });
  } catch (e: unknown) {
    const err = e as Error;
    if (err.message.includes('UNIQUE constraint failed: inspections.application_id')) {
      return res.status(409).json({ error: 'Inspection already submitted' });
    }
    if (err.message.includes('Fee gate not satisfied') || err.message.includes('GATE_BLOCKED')) {
      return res.status(409).json({ error: 'Fee gate not satisfied' });
    }
    return res.status(500).json({ error: err.message });
  }
}
