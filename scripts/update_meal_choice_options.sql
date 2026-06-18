-- Run once in Supabase SQL Editor to align meal_choice with the current RSVP menu.
-- Clears any legacy fish selections before tightening the check constraint.

UPDATE guests SET meal_choice = NULL WHERE meal_choice = 'fish';

ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_meal_choice_check;

ALTER TABLE guests
    ADD CONSTRAINT guests_meal_choice_check
    CHECK (meal_choice IS NULL OR meal_choice IN ('chicken', 'beef', 'vegetarian'));
