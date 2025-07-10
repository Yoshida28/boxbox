-- Create thumbnail_cache table
CREATE TABLE public.thumbnail_cache (
  id uuid not null default gen_random_uuid (),
  race_name text not null,
  video_id text not null,
  thumbnail_url text not null,
  channel_title text null,
  video_title text null,
  year text null,
  cached_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint thumbnail_cache_pkey primary key (id),
  constraint thumbnail_cache_race_name_year_key unique (race_name, year)
) TABLESPACE pg_default;

-- Create indexes for faster fetching
CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_race_year ON public.thumbnail_cache USING btree (race_name, year) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_cached_at ON public.thumbnail_cache USING btree (cached_at desc) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_thumbnail_cache_video_id ON public.thumbnail_cache USING btree (video_id) TABLESPACE pg_default;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_thumbnail_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_thumbnail_cache_updated_at 
  BEFORE UPDATE ON thumbnail_cache 
  FOR EACH ROW
  EXECUTE FUNCTION update_thumbnail_cache_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE public.thumbnail_cache ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can restrict this as needed)
CREATE POLICY "Allow all operations on thumbnail_cache" ON public.thumbnail_cache
  FOR ALL USING (true); 