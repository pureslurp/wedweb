-- Run once in Supabase SQL Editor if `marriott_stay` is missing from `guests`.
-- Guests self-report whether they are staying at the room-block hotel; shuttle is only asked when yes.

ALTER TABLE guests ADD COLUMN IF NOT EXISTS marriott_stay TEXT;

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_marriott_stay_check;

ALTER TABLE guests
    ADD CONSTRAINT guests_marriott_stay_check
    CHECK (marriott_stay IS NULL OR marriott_stay IN ('yes', 'no'));
