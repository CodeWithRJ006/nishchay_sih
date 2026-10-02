// Audit repository – records actions in audit_log table
// Exported function matches imports from certificateService and other services

import { db, transaction } from '../db/index.js';

/**
 * Record an audit entry.
 * @param recordId - The primary key of the record being audited (e.g., application id or certificate id)
 * @param changedBy - User id performing the action
 * @param action - Action name (e.g., 'CERTIFICATE_ISSUED')
 * @param details - JSON string with additional details
 */
export function recordAudit(recordId: string, changedBy: string, action: string, details: string): void {
  // Use transaction wrapper for consistency with other DB writes
  transaction(() => {
    const stmt = db.prepare(`
      INSERT INTO audit_log (
        id,
        table_name,
        record_id,
        action,
        changed_by,
        new_data,
        timestamp
      ) VALUES (
        hex(randomblob(16)),
        ?,
        ?,
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP
      )
    `);
    // Derive table name from recordId format: we assume callers pass appropriate table name via details or convention.
    // For simplicity we set table_name to 'unknown' – callers can adjust if needed.
    stmt.run('unknown', recordId, action, changedBy, details);
  });
}
