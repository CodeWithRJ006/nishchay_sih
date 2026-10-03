-- Migration to add category to certificate_complaints
ALTER TABLE certificate_complaints ADD COLUMN category TEXT NOT NULL DEFAULT 'Other';
