import { z } from 'zod';
import { db } from '../db/index.js';

export const SORT_COLUMNS: Record<string, string> = {
  valid_to: 'c.valid_to',
  valid_from: 'c.valid_from',
  status: 'c.status',
  instrument_id: 'c.instrument_id',
  instrument_class: 'i.type_code',
  business_name: 'b.name',
  public_id: 'c.public_id'
};

export const CertificateSearchSchema = z.object({
  instrumentId: z.string().optional(),
  businessName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  class: z.string().optional(),
  status: z.string().optional(),
  sort: z.string().refine(val => !val || Object.prototype.hasOwnProperty.call(SORT_COLUMNS, val), {
    message: 'Invalid sort column'
  }).default('valid_to'),
  order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CertificateSearchParams = z.infer<typeof CertificateSearchSchema>;

export interface CertificateRow {
  id: string;
  public_id: string;
  instrument_id: string;
  instrument_class: string;
  status: string;
  valid_from: string;
  valid_to: string;
  business_name: string;
}

export function buildCertificatesQuery(
  rawQuery: unknown,
  user?: Express.Request['user']
) {
  const parsed = CertificateSearchSchema.safeParse(rawQuery);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map(e => e.message).join(', '));
    (err as unknown as { status: number; code: string }).status = 400;
    (err as unknown as { status: number; code: string }).code = 'BAD_REQUEST';
    throw err;
  }

  const {
    instrumentId,
    businessName,
    startDate,
    endDate,
    class: instrumentClass,
    status,
    sort,
    order,
    page,
    pageSize
  } = parsed.data;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Scoping by role (B4 requirement)
  if (user?.role === 'BUSINESS') {
    conditions.push('b.owner_id = ?');
    params.push(user.id);
  } else if (user?.role === 'LMO' || user?.role === 'GATC') {
    const userRow = db.prepare('SELECT zone_id FROM users WHERE id = ?').get(user.id) as { zone_id?: string } | undefined;
    if (userRow?.zone_id) {
      conditions.push('b.zone_id = ?');
      params.push(userRow.zone_id);
    }
  }

  if (instrumentId) {
    conditions.push('c.instrument_id = ?');
    params.push(instrumentId);
  }
  if (instrumentClass) {
    conditions.push('i.type_code = ?');
    params.push(instrumentClass);
  }
  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }
  if (businessName) {
    conditions.push('b.name LIKE ?');
    params.push(`%${businessName}%`);
  }
  if (startDate) {
    conditions.push('c.valid_from >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('c.valid_to <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const sortColumn = SORT_COLUMNS[sort] || 'c.valid_to';
  const sortDirection = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const baseSelect = `
    SELECT c.id, c.public_id, c.instrument_id, i.type_code as instrument_class, c.status,
           c.valid_from, c.valid_to, b.name as business_name
    FROM certificates c
    JOIN instruments i ON c.instrument_id = i.id
    JOIN businesses b ON i.business_id = b.id
    ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}
  `;

  return {
    baseSelect,
    params,
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}
