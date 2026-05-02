-- Run once in Supabase SQL Editor if `family` is missing from `guests`.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS family TEXT;

CREATE INDEX IF NOT EXISTS idx_guests_family ON guests(family) WHERE family IS NOT NULL;
