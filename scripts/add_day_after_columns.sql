-- Run once in Supabase SQL Editor if day-after party columns are missing from `guests`.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS day_after_invited BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS day_after_rsvp TEXT;

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_day_after_rsvp_check;

ALTER TABLE guests
    ADD CONSTRAINT guests_day_after_rsvp_check
    CHECK (day_after_rsvp IS NULL OR day_after_rsvp IN ('yes', 'no'));
