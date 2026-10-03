-- Add revoked_at column to certificates
ALTER TABLE certificates ADD COLUMN revoked_at TEXT;
