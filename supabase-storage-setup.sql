-- =============================================================================
-- Supabase Storage — Post Images Bucket
-- =============================================================================
-- Run this in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/gqglwmchhjxzoogixbar/sql/new
-- =============================================================================

-- 1. Create the public bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  4194304,  -- 4MB max
  '{image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp}'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow INSERT (upload) to anyone — the API route handles next-auth auth
CREATE POLICY "Allow upload to post-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'post-images');

-- 3. Allow public SELECT (view/download)
CREATE POLICY "Allow public read post-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

-- 4. Allow DELETE (users can delete their own uploads via API)
CREATE POLICY "Allow delete from post-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'post-images');
