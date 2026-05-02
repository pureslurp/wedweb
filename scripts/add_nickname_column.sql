-- Run once in Supabase SQL Editor if `nickname` is missing from `guests`.
-- Optional: guests can be found by legal first name or by this nickname (e.g. "Bob" for "Robert").
ALTER TABLE guests ADD COLUMN IF NOT EXISTS nickname TEXT;

CREATE INDEX IF NOT EXISTS idx_guests_nickname ON guests (nickname)
    WHERE nickname IS NOT NULL AND trim(nickname) <> '';
