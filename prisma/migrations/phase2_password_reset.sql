-- Phase 2: Password Reset — User model extension
-- Adds resetToken and resetTokenExpiry columns for password reset flow

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "resetToken" TEXT,
  ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMPTZ;
