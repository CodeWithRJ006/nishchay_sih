DROP TABLE IF EXISTS certificates;
CREATE TABLE certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    application_id TEXT NOT NULL,
    instrument_id TEXT NOT NULL,
    receipt_id TEXT NOT NULL UNIQUE,
    public_record TEXT NOT NULL,
    hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    key_id TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('VALID','REVOKED','EXPIRED')),
    details_digest TEXT NOT NULL,
    revoked_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);
