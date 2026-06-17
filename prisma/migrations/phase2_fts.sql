-- Phase 2 FTS: Full-text search on Post.title + content
-- Uses 'simple' dictionary for Chinese + English compatibility
-- Apply via Supabase Dashboard SQL Editor

-- 1. Add tsvector column
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- 2. GIN index for fast FTS queries
CREATE INDEX IF NOT EXISTS idx_post_search_vector ON "Post" USING GIN ("searchVector");

-- 3. Function to compute search vector from title + content text
CREATE OR REPLACE FUNCTION post_search_vector_update() RETURNS trigger AS $$
DECLARE
  content_text text;
BEGIN
  -- Extract plain text from content JSON: coalesce to empty string
  content_text := COALESCE(NEW."content"::text, '');
  NEW."searchVector" :=
    setweight(to_tsvector('simple', COALESCE(NEW."title", '')), 'A') ||
    setweight(to_tsvector('simple', content_text), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger to auto-update searchVector on INSERT or UPDATE
DROP TRIGGER IF EXISTS trg_post_search_vector ON "Post";
CREATE TRIGGER trg_post_search_vector
  BEFORE INSERT OR UPDATE OF "title", "content" ON "Post"
  FOR EACH ROW
  EXECUTE FUNCTION post_search_vector_update();

-- 5. Backfill existing posts
UPDATE "Post"
SET "searchVector" =
  setweight(to_tsvector('simple', COALESCE("title", '')), 'A') ||
  setweight(to_tsvector('simple', COALESCE("content"::text, '')), 'B')
WHERE "searchVector" IS NULL;
