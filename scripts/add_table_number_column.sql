-- Run once in Supabase SQL Editor if `table_number` is missing from `guests`.
-- Assign seating chart table numbers for attending guests.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS table_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_guests_table_number
    ON guests (table_number)
    WHERE table_number IS NOT NULL;
