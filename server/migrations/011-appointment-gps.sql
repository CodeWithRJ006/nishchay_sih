ALTER TABLE appointments ADD COLUMN arrived_lat REAL;
ALTER TABLE appointments ADD COLUMN arrived_lng REAL;
ALTER TABLE appointments ADD COLUMN arrived_distance REAL;
ALTER TABLE appointments ADD COLUMN is_demo_location INTEGER DEFAULT 0;
