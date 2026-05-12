-- Add latitude/longitude columns to posts table for pinning observations on the map
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision;

-- Index for spatial queries (e.g. "show nearby posts")
CREATE INDEX IF NOT EXISTS idx_posts_coordinates
ON public.posts (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
