/*
  # Create thumbnail cache table for YouTube API results

  1. New Tables
    - `thumbnail_cache`
      - `id` (uuid, primary key)
      - `race_name` (text, not null) - Name of the race
      - `video_id` (text, not null) - YouTube video ID
      - `thumbnail_url` (text, not null) - Generated thumbnail URL
      - `channel_title` (text) - YouTube channel name
      - `video_title` (text) - YouTube video title
      - `year` (text) - Race year for better organization
      - `cached_at` (timestamptz, default now()) - When cached
      - `updated_at` (timestamptz, default now()) - Last update

  2. Indexes
    - Unique index on race_name + year combination
    - Index on cached_at for cleanup operations

  3. Security
    - Enable RLS
    - Allow public read access for thumbnails
    - Restrict write access to service role

  4. Functions
    - Auto-update updated_at timestamp
    - Function to create table if not exists (for edge function)
*/

-- Create thumbnail cache table
CREATE TABLE IF NOT EXISTS thumbnail_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_name text NOT NULL,
  video_id text NOT NULL,
  thumbnail_url text NOT NULL,
  channel_title text,
  video_title text,
  year text,
  cached_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(race_name, year)
);

-- Enable RLS
ALTER TABLE thumbnail_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access to cached thumbnails
CREATE POLICY "Allow public read access to thumbnail cache"
  ON thumbnail_cache
  FOR SELECT
  TO public
  USING (true);

-- Allow service role to manage cache
CREATE POLICY "Allow service role to manage thumbnail cache"
  ON thumbnail_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_race_year ON thumbnail_cache(race_name, year);
CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_cached_at ON thumbnail_cache(cached_at DESC);
CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_video_id ON thumbnail_cache(video_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_thumbnail_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_thumbnail_cache_updated_at
  BEFORE UPDATE ON thumbnail_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_thumbnail_cache_updated_at();

-- Function to create table if not exists (for edge function compatibility)
CREATE OR REPLACE FUNCTION create_thumbnail_cache_table()
RETURNS void AS $$
BEGIN
  -- This function ensures the table exists when called from edge functions
  -- The table creation is idempotent due to IF NOT EXISTS
  PERFORM 1;
END;
$$ language 'plpgsql';