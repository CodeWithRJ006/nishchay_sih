DROP TABLE IF EXISTS inspection_photos;
DROP TABLE IF EXISTS inspections;

CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  application_id TEXT UNIQUE NOT NULL,
  officer_id TEXT NOT NULL,
  gps_lat REAL NOT NULL,
  gps_lng REAL NOT NULL,
  gps_distance REAL NOT NULL,
  checklist TEXT NOT NULL, -- JSON
  readings TEXT NOT NULL, -- JSON
  pass BOOLEAN NOT NULL,
  reasons TEXT, -- JSON array of reasons if fail or override
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (officer_id) REFERENCES users(id)
);

CREATE TABLE inspection_photos (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL, -- Associate directly with application for easier querying before inspection submit
  uploader_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  client_capture_time TEXT NOT NULL,
  server_receive_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);
