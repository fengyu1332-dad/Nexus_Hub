-- Phase 3a: Pipeline Observability — PipelineExecution + EmbeddingJob
-- Apply via Supabase Dashboard SQL Editor

-- 1. PipelineExecution — unified async pipeline execution tracking
CREATE TABLE IF NOT EXISTS "PipelineExecution" (
  "id"             TEXT PRIMARY KEY,
  "pipelineType"   TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "entityId"       TEXT,
  "inputSummary"   TEXT,
  "outputSummary"  TEXT,
  "errorMessage"   TEXT,
  "startedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"    TIMESTAMPTZ,
  "durationMs"     INTEGER,
  "retryCount"     INTEGER NOT NULL DEFAULT 0,
  "maxRetries"     INTEGER NOT NULL DEFAULT 3,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_pipeline_exec_type_status"
  ON "PipelineExecution"("pipelineType", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_pipeline_exec_entity"
  ON "PipelineExecution"("entityId");

-- 2. EmbeddingJob — per-post embedding generation state
CREATE TABLE IF NOT EXISTS "EmbeddingJob" (
  "id"             TEXT PRIMARY KEY,
  "postId"         TEXT NOT NULL UNIQUE,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"  TIMESTAMPTZ,
  "errorMessage"   TEXT,
  "dimensions"     INTEGER,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_embedding_job_status"
  ON "EmbeddingJob"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_embedding_job_post"
  ON "EmbeddingJob"("postId");
