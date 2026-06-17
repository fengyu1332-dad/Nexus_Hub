-- Phase 3d: Content Organization Enhancement
-- Tag taxonomy for AI-generated posts

CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "category" TEXT,
  "postCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Tag_category_idx" ON "Tag" ("category");
CREATE INDEX IF NOT EXISTS "Tag_slug_idx" ON "Tag" ("slug");

CREATE TABLE IF NOT EXISTS "PostTag" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "PostTag_postId_tagId_key" ON "PostTag" ("postId", "tagId");
CREATE INDEX IF NOT EXISTS "PostTag_postId_idx" ON "PostTag" ("postId");
CREATE INDEX IF NOT EXISTS "PostTag_tagId_idx" ON "PostTag" ("tagId");
