CREATE UNIQUE INDEX idx_payments_paid_app ON payments(application_id) WHERE status = 'PAID';
ALTER TABLE receipts ADD COLUMN signature TEXT;
ALTER TABLE receipts ADD COLUMN amount INTEGER;
