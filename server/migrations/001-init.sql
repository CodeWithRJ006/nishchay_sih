CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  zone_id TEXT,
  failed_attempts INTEGER DEFAULT 0,
  locked_until DATETIME
);

CREATE TABLE zones (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gstin TEXT,
  address TEXT NOT NULL,
  zone_id TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

CREATE TABLE instruments (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  type_code TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  capacity TEXT NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  state TEXT NOT NULL,
  assigned_officer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id),
  FOREIGN KEY (instrument_id) REFERENCES instruments(id),
  FOREIGN KEY (assigned_officer_id) REFERENCES users(id)
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL,
  payment_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL,
  scheduled_date DATETIME NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL,
  officer_id TEXT NOT NULL,
  pass BOOLEAN NOT NULL,
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (officer_id) REFERENCES users(id)
);

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  receipt_id TEXT UNIQUE NOT NULL,
  valid_from DATETIME NOT NULL,
  valid_to DATETIME NOT NULL,
  seal_hash TEXT NOT NULL,
  seal_signature TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (receipt_id) REFERENCES receipts(id)
);

CREATE TABLE application_documents (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id)
);

CREATE TABLE inspection_photos (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id)
);

CREATE TABLE complaints (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by TEXT,
  old_data TEXT,
  new_data TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER block_audit_update BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'Update on audit_log is prohibited.');
END;

CREATE TRIGGER block_audit_delete BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'Delete on audit_log is prohibited.');
END;

CREATE TABLE counters (
  id TEXT PRIMARY KEY,
  val INTEGER NOT NULL DEFAULT 0
);

-- Search Indexes
CREATE INDEX idx_business_name ON businesses(name);
CREATE INDEX idx_instrument_type ON instruments(type_code);
CREATE INDEX idx_application_state ON applications(state);
CREATE INDEX idx_certificate_status ON certificates(status);
