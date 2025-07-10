/*
  # Fix reviews table schema - Remove profile_id requirement

  1. Problem
    - Migration 20250628154128_proud_dust.sql added profile_id column
    - References non-existent profiles table
    - Application code still uses user_id
    - Causing NOT NULL constraint violations

  2. Solution
    - Remove profile_id column and foreign key constraint
    - Keep user_id as the primary user reference
    - Maintain existing RLS policies
    - Ensure data integrity
*/

-- Drop the foreign key constraint first
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_profile_id_fkey;

-- Drop the index on profile_id
DROP INDEX IF EXISTS idx_reviews_profile_id;

-- Remove the profile_id column
ALTER TABLE reviews DROP COLUMN IF EXISTS profile_id;

-- Verify the table structure is correct
-- reviews table should now have:
-- - id (uuid, primary key)
-- - race_id (uuid, foreign key to races)
-- - user_id (uuid, foreign key to auth.users)
-- - rating (integer, 1-5)
-- - body (text)
-- - created_at (timestamptz)
-- - updated_at (timestamptz)

-- Ensure the unique constraint on race_id + user_id exists
ALTER TABLE reviews ADD CONSTRAINT IF NOT EXISTS reviews_race_user_unique UNIQUE(race_id, user_id);

-- Verify RLS policies are still in place
-- (These should already exist from the original migration) 