-- Block 4a migration
ALTER TABLE businesses ADD COLUMN type TEXT;
ALTER TABLE businesses ADD COLUMN lat REAL;
ALTER TABLE businesses ADD COLUMN lng REAL;
ALTER TABLE businesses ADD COLUMN phone TEXT;
ALTER TABLE businesses ADD COLUMN email TEXT;

ALTER TABLE users ADD COLUMN daily_capacity INTEGER;
ALTER TABLE users ADD COLUMN gatc_centre_name TEXT;
