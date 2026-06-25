-- Supabase Migration: Add isFeatured / featuredAt to Post
-- Run this in Supabase SQL Editor if the Prisma migration doesn't sync to Supabase

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMPTZ;
