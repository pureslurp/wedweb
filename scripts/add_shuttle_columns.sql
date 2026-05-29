-- Run once in Supabase SQL Editor if shuttle columns are missing from `guests`.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS shuttle_offered BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS shuttle_rsvp TEXT;

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_shuttle_rsvp_check;

ALTER TABLE guests
    ADD CONSTRAINT guests_shuttle_rsvp_check
    CHECK (shuttle_rsvp IS NULL OR shuttle_rsvp IN ('yes', 'no'));
