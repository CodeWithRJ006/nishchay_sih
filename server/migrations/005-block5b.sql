DROP TABLE IF EXISTS appointments;
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE,
  officer_id TEXT,
  slot_date TEXT NOT NULL, -- YYYY-MM-DD
  slot_time TEXT NOT NULL, -- MORNING, AFTERNOON, EVENING
  status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, ACCEPTED
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES applications(id),
  FOREIGN KEY(officer_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS officer_rejections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL,
  officer_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(application_id) REFERENCES applications(id),
  FOREIGN KEY(officer_id) REFERENCES users(id),
  UNIQUE(application_id, officer_id)
);


