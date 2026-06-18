-- Phase 4b: Newsletter Automation
-- Add unsubscribe token support and email tracking

-- Add unsubscribe token column
ALTER TABLE "NewsletterSubscriber" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;
ALTER TABLE "NewsletterSubscriber" ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMPTZ;

-- Create unique index on unsubscribeToken
CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscriber_unsubscribeToken_key"
  ON "NewsletterSubscriber"("unsubscribeToken");
