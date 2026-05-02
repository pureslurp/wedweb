-- Run once in Supabase SQL Editor if your `guests` table was created before `post_rsvp_message` existed.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS post_rsvp_message TEXT;
