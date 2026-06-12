-- Phase D: AI 系统管理 + 情报源配置
-- 在 Supabase SQL Editor 中执行

-- 1. IntelSource — 情报源配置
CREATE TABLE IF NOT EXISTS "IntelSource" (
  "id"                  TEXT PRIMARY KEY,
  "label"               TEXT NOT NULL,
  "url"                 TEXT NOT NULL,
  "type"                TEXT NOT NULL DEFAULT 'webpage',  -- 'rss' | 'webpage'
  "category"            TEXT,                              -- 'admissions' | 'exams' | 'rankings' | 'general'
  "priority"            TEXT NOT NULL DEFAULT 'medium',   -- 'high' | 'medium' | 'low'
  "crawlInterval"       INTEGER NOT NULL DEFAULT 30,      -- minutes
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "contentSelector"     TEXT,                              -- CSS selector for main content
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "maxFailures"         INTEGER NOT NULL DEFAULT 5,
  "lastCrawlAt"         TIMESTAMPTZ,
  "lastError"           TEXT,
  "crawlCount"          INTEGER NOT NULL DEFAULT 0,
  "articleCount"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. CrawlLog — 采集日志
CREATE TABLE IF NOT EXISTS "CrawlLog" (
  "id"            TEXT PRIMARY KEY,
  "sourceId"      TEXT NOT NULL REFERENCES "IntelSource"("id") ON DELETE CASCADE,
  "status"        TEXT NOT NULL,                          -- 'success' | 'failed' | 'deduplicated'
  "url"           TEXT,
  "title"         TEXT,
  "contentHash"   TEXT,
  "contentLength" INTEGER,
  "errorMessage"  TEXT,
  "postId"        TEXT,
  "duration"      INTEGER,                                -- ms
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_crawl_log_source_created"
  ON "CrawlLog" ("sourceId", "createdAt" DESC);

-- 3. PipelineConfig — 管线配置（键值对）
CREATE TABLE IF NOT EXISTS "PipelineConfig" (
  "id"        TEXT PRIMARY KEY,
  "key"       TEXT NOT NULL UNIQUE,
  "value"     TEXT NOT NULL,                              -- JSON
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: global crawl interval default
INSERT INTO "PipelineConfig" ("id", "key", "value")
VALUES (
  'cfg-global-interval',
  'global_crawl_interval',
  '30'
) ON CONFLICT DO NOTHING;

-- Seed: night quiet hours
INSERT INTO "PipelineConfig" ("id", "key", "value")
VALUES (
  'cfg-night-quiet',
  'night_quiet_hours',
  '{"enabled": false, "startHour": 0, "endHour": 7}'
) ON CONFLICT DO NOTHING;

-- Seed: Guardian Education source
INSERT INTO "IntelSource" ("id", "label", "url", "type", "category", "priority", "crawlInterval", "contentSelector", "isActive")
VALUES (
  'seed-guardian-edu',
  'Guardian Education',
  'https://www.theguardian.com/education/universityguide',
  'webpage',
  'admissions',
  'high',
  60,
  'article',
  true
) ON CONFLICT DO NOTHING;

-- Seed: THE World University News
INSERT INTO "IntelSource" ("id", "label", "url", "type", "category", "priority", "crawlInterval", "isActive")
VALUES (
  'seed-the-news',
  'THE University News',
  'https://www.timeshighereducation.com/news',
  'webpage',
  'general',
  'high',
  120,
  true
) ON CONFLICT DO NOTHING;

-- Seed: Inside Higher Ed
INSERT INTO "IntelSource" ("id", "label", "url", "type", "category", "priority", "crawlInterval", "isActive")
VALUES (
  'seed-inside-higher-ed',
  'Inside Higher Ed',
  'https://www.insidehighered.com/news',
  'webpage',
  'general',
  'medium',
  180,
  true
) ON CONFLICT DO NOTHING;
