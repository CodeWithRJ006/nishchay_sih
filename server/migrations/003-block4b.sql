ALTER TABLE instruments ADD COLUMN serial TEXT NOT NULL DEFAULT 'TEMP';
ALTER TABLE instruments ADD COLUMN accuracy_class TEXT;
ALTER TABLE instruments ADD COLUMN location TEXT;
CREATE UNIQUE INDEX idx_instruments_business_serial ON instruments(business_id, serial);
ALTER TABLE applications ADD COLUMN fee_amount INTEGER;
ALTER TABLE applications ADD COLUMN routing_rule TEXT;
ALTER TABLE application_documents ADD COLUMN file_hash TEXT;
