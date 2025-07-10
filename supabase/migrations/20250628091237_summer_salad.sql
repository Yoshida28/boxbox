/*
  # Add missing columns to races table

  1. Changes
    - Add `thumbnail_url` column to races table
    - Add `youtube_video_id` column to races table  
    - Add `video_url` column to races table

  2. Security
    - No RLS changes needed as table already has proper policies
*/

-- Add missing columns to races table
DO $$
BEGIN
  -- Add thumbnail_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'races' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE races ADD COLUMN thumbnail_url text;
  END IF;

  -- Add youtube_video_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'races' AND column_name = 'youtube_video_id'
  ) THEN
    ALTER TABLE races ADD COLUMN youtube_video_id text;
  END IF;

  -- Add video_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'races' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE races ADD COLUMN video_url text;
  END IF;
END $$;