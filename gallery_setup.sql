-- ─────────────────────────────────────────────────────────
-- La Cocinita de Vanessa — Gallery setup
-- Run this once in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────

-- 1. Gallery metadata table
CREATE TABLE IF NOT EXISTS gallery (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  tag         text,                          -- short descriptor, e.g. "Tres Leches Base"
  photo_url   text        NOT NULL,          -- full public URL from Supabase Storage
  sort_order  int         DEFAULT 0,         -- lower = shown first; use to reorder photos
  created_at  timestamptz DEFAULT now()
);

-- 2. RLS — enable and allow public reads
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view gallery"
ON gallery FOR SELECT TO anon
USING (true);

-- 3. Storage bucket — make the gallery bucket publicly readable
--    (Create the bucket named "gallery" in Storage UI first, then run this)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public read gallery photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'gallery');
