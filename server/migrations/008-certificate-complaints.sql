-- Migration to add complaints table for Right-to-Check feature (Block 10)
CREATE TABLE IF NOT EXISTS certificate_complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
CREATE INDEX IF NOT EXISTS idx_certificate_complaints_public_id ON certificate_complaints(public_id);
