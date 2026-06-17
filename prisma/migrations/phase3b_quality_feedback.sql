-- Phase 3b: AI Quality Feedback Loop
-- PostFeedback: user feedback on AI-generated posts
CREATE TABLE IF NOT EXISTS "PostFeedback" (
  "id" TEXT PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" TEXT NOT NULL,  -- 'helpful' | 'not_helpful'
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "PostFeedback_postId_userId_key" ON "PostFeedback" ("postId", "userId");
CREATE INDEX IF NOT EXISTS "PostFeedback_postId_idx" ON "PostFeedback" ("postId");
CREATE INDEX IF NOT EXISTS "PostFeedback_userId_idx" ON "PostFeedback" ("userId");

-- PromptVersion: versioned prompt templates per agent role
CREATE TABLE IF NOT EXISTS "PromptVersion" (
  "id" TEXT PRIMARY KEY,
  "agentRole" TEXT NOT NULL,
  "promptName" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "content" TEXT NOT NULL,
  "changeNotes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "PromptVersion_agentRole_idx" ON "PromptVersion" ("agentRole");
CREATE INDEX IF NOT EXISTS "PromptVersion_isActive_idx" ON "PromptVersion" ("isActive");
