CREATE TABLE IF NOT EXISTS certificate_tamper_backup (
  cert_id TEXT PRIMARY KEY,
  original_record TEXT NOT NULL,
  tampered_at INTEGER NOT NULL
);
