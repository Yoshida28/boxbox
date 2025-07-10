/*
  # Update races table schema for F1 API integration

  1. New Columns Added
    - `grand_prix_name` (text, not null) - Name of the Grand Prix
    - `circuit_name` (text, not null) - Name of the circuit
    - `date` (date, not null) - Race date
    - `winner` (text, not null) - Race winner
    - `podium` (text[], default empty array) - Podium finishers
    - `notable_moments` (text, nullable) - Notable race moments
    - `track_layout_image_url` (text, nullable) - Track layout image
    - `video_url` (text, nullable) - Video URL
    - `updated_at` (timestamptz, default now()) - Last update timestamp

  2. Data Migration
    - Safely migrate existing data if old columns exist
    - Set default values for required fields

  3. Indexes
    - Add performance indexes for date, grand prix name, and circuit name

  4. Security
    - Maintain existing RLS policies
*/

-- First, let's add the new columns
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'grand_prix_name') THEN
    ALTER TABLE races ADD COLUMN grand_prix_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'circuit_name') THEN
    ALTER TABLE races ADD COLUMN circuit_name text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'date') THEN
    ALTER TABLE races ADD COLUMN date date;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'winner') THEN
    ALTER TABLE races ADD COLUMN winner text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'podium') THEN
    ALTER TABLE races ADD COLUMN podium text[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'notable_moments') THEN
    ALTER TABLE races ADD COLUMN notable_moments text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'track_layout_image_url') THEN
    ALTER TABLE races ADD COLUMN track_layout_image_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'video_url') THEN
    ALTER TABLE races ADD COLUMN video_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'updated_at') THEN
    ALTER TABLE races ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Migrate existing data to new columns (only if old columns exist)
DO $$
BEGIN
  -- Check if old columns exist and migrate data
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'title') THEN
    UPDATE races 
    SET grand_prix_name = title
    WHERE grand_prix_name IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'circuit') THEN
    UPDATE races 
    SET circuit_name = circuit
    WHERE circuit_name IS NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'races' AND column_name = 'year') THEN
    UPDATE races 
    SET date = (year || '-01-01')::date
    WHERE date IS NULL;
  END IF;
  
  -- Set default values for required fields that don't have data
  UPDATE races 
  SET 
    grand_prix_name = COALESCE(grand_prix_name, 'Unknown Grand Prix'),
    circuit_name = COALESCE(circuit_name, 'Unknown Circuit'),
    date = COALESCE(date, '2023-01-01'::date),
    winner = COALESCE(winner, 'TBD'),
    podium = COALESCE(podium, '{}')
  WHERE grand_prix_name IS NULL 
     OR circuit_name IS NULL 
     OR date IS NULL 
     OR winner IS NULL 
     OR podium IS NULL;
END $$;

-- Make new columns NOT NULL after data migration
ALTER TABLE races ALTER COLUMN grand_prix_name SET NOT NULL;
ALTER TABLE races ALTER COLUMN circuit_name SET NOT NULL;
ALTER TABLE races ALTER COLUMN date SET NOT NULL;
ALTER TABLE races ALTER COLUMN winner SET NOT NULL;
ALTER TABLE races ALTER COLUMN podium SET NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_races_date ON races USING btree (date DESC);
CREATE INDEX IF NOT EXISTS idx_races_grand_prix_name ON races USING btree (grand_prix_name);
CREATE INDEX IF NOT EXISTS idx_races_circuit_name ON races USING btree (circuit_name);

-- Update the updated_at column trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_races_updated_at' 
    AND event_object_table = 'races'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $trigger$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql;

    CREATE TRIGGER update_races_updated_at
      BEFORE UPDATE ON races
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;