/*
  # Add relationship between reviews and profiles tables

  1. Schema Changes
    - Add `profile_id` column to `reviews` table (uuid, NOT NULL)
    - Add foreign key constraint linking `reviews.profile_id` to `profiles.id`
    - Create index on `reviews.profile_id` for performance
    - Populate `profile_id` with corresponding profile data based on existing `user_id`

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with CASCADE options

  3. Performance
    - Add index on `profile_id` column for fast joins
*/

-- First, add the profile_id column as nullable
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS profile_id uuid;

-- Populate the profile_id column with data from profiles table based on user_id
UPDATE reviews 
SET profile_id = profiles.id 
FROM profiles 
WHERE reviews.user_id = profiles.id;

-- Now make the column NOT NULL since it should be populated
ALTER TABLE reviews ALTER COLUMN profile_id SET NOT NULL;

-- Add foreign key constraint with CASCADE options
ALTER TABLE reviews 
ADD CONSTRAINT reviews_profile_id_fkey 
FOREIGN KEY (profile_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Add comment to the constraint explaining its purpose
COMMENT ON CONSTRAINT reviews_profile_id_fkey ON reviews IS 'Links reviews to the author''s profile for joining review data with user profile information';

-- Create index on profile_id for fast joins
CREATE INDEX IF NOT EXISTS idx_reviews_profile_id ON reviews(profile_id);