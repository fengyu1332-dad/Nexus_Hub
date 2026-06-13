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
INSERT INTO "PipelineConfig" ("id", "key", "value", "updatedAt")
VALUES (
  'cfg-global-interval',
  'global_crawl_interval',
  '30',
  now()
) ON CONFLICT DO NOTHING;

-- Seed: night quiet hours
INSERT INTO "PipelineConfig" ("id", "key", "value", "updatedAt")
VALUES (
  'cfg-night-quiet',
  'night_quiet_hours',
  '{"enabled": false, "startHour": 0, "endHour": 7}',
  now()
) ON CONFLICT DO NOTHING;

-- Seed: Guardian Education source
INSERT INTO "IntelSource" ("id", "label", "url", "type", "category", "priority", "crawlInterval", "contentSelector", "isActive", "createdAt", "updatedAt")
VALUES (
  'seed-guardian-edu',
  'Guardian Education',
  'https://www.theguardian.com/education/universityguide',
  'webpage',
  'admissions',
  'high',
  60,
  'article',
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- Seed: THE World University News
INSERT INTO "IntelSource" ("id", "label", "url", "type", "category", "priority", "crawlInterval", "isActive", "createdAt", "updatedAt")
VALUES (
  'seed-the-news',
  'THE University News',
  'https://www.timeshighereducation.com/news',
  'webpage',
  'general',
  'high',
  120,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- Seed: Inside Higher Ed
INSERT INTO "IntelSource" ("id", "label", "url", "type", "category", "priority", "crawlInterval", "isActive", "createdAt", "updatedAt")
VALUES (
  'seed-inside-higher-ed',
  'Inside Higher Ed',
  'https://www.insidehighered.com/news',
  'webpage',
  'general',
  'medium',
  180,
  true,
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- Phase D.2: Official Discussion Boards
-- ═══════════════════════════════════════════════════════

-- Add board metadata columns to Subreddit
ALTER TABLE "Subreddit" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Subreddit" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Subreddit" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subreddit" ADD COLUMN IF NOT EXISTS "isOfficial" BOOLEAN NOT NULL DEFAULT false;

-- Seed 15 official discussion boards (5 categories)
INSERT INTO "Subreddit" ("id", "name", "category", "description", "sortOrder", "isOfficial", "creatorId", "createdAt", "updatedAt")
VALUES
  -- 📚 标化考试
  ('board-sat-act',          'sat-act',          'exams',         'SAT/ACT备考、真题解析、提分策略、考位资讯', 1, true, NULL, now(), now()),
  ('board-ap-olympiad',      'ap-olympiad',      'exams',         'AP选课与备考、AMC/BPhO/USACO等学科竞赛经验', 2, true, NULL, now(), now()),
  ('board-alevel-ib',        'alevel-ib',        'exams',         'A-Level/IB选课策略、EE/TOK指导、全球统考动态', 3, true, NULL, now(), now()),
  ('board-lang-exams',       'lang-exams',       'exams',         '托福/雅思/Duolingo/PTE备考交流与机经分享', 4, true, NULL, now(), now()),
  -- 🎓 申请实战
  ('board-school-select',    'school-select',    'applications',  '选校定位、录取数据分析、匹配度评估', 5, true, NULL, now(), now()),
  ('board-essay-writing',    'essay-writing',    'applications',  '个人陈述、Why Essay、补充文书、活动列表打磨', 6, true, NULL, now(), now()),
  ('board-app-strategy',     'app-strategy',     'applications',  'ED/EA/RD策略、推荐信、面试准备、Waitlist应对', 7, true, NULL, now(), now()),
  ('board-bg-boost',         'bg-boost',         'applications',  '夏校申请、科研实习、竞赛辅导、课外活动规划', 8, true, NULL, now(), now()),
  -- 🌍 院校洞见
  ('board-us-undergrad',     'us-undergrad',     'insights',      '美国Top综合大学与文理学院深度解读', 9, true, NULL, now(), now()),
  ('board-uk-commonwealth',  'uk-commonwealth',  'insights',      '牛津剑桥/IC/LSE/UCL及加拿大/澳洲名校', 10, true, NULL, now(), now()),
  ('board-eu-asia',          'eu-asia',          'insights',      '欧陆/日本/新加坡/香港留学申请与院校动态', 11, true, NULL, now(), now()),
  -- 🛂 签证与行前
  ('board-visa-immigration', 'visa-immigration', 'visa',          'F1/学生签证/OPT/CPT/各国移民政策解读', 12, true, NULL, now(), now()),
  ('board-pre-departure',    'pre-departure',    'visa',          '机票住宿/疫苗体检/银行开户/保险等行前准备', 13, true, NULL, now(), now()),
  -- 💼 留学之后
  ('board-career-jobs',      'career-jobs',      'career',        'CPT/OPT/H1B/回国求职/行业选择/校友内推', 14, true, NULL, now(), now()),
  ('board-student-life',     'student-life',     'career',        '文化适应/社交/安全/心理健康/留学日常', 15, true, NULL, now(), now())
ON CONFLICT ("name") DO UPDATE
  SET "category"    = EXCLUDED."category",
      "description" = EXCLUDED."description",
      "sortOrder"   = EXCLUDED."sortOrder",
      "isOfficial"  = EXCLUDED."isOfficial";
