-- ═══════════════════════════════════════════════════════
-- Nexus Hub — P4 AI 能力增强 Schema 变更
-- 请复制到 Supabase SQL Editor 执行
-- Dashboard → SQL Editor → New query → 粘贴 → Run
-- ═══════════════════════════════════════════════════════

-- 1. ChatSession — Flora 对话历史（可选，服务端持久化）
CREATE TABLE IF NOT EXISTS "ChatSession" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "title"     TEXT,
  "messages"  JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_chat_session_user"
  ON "ChatSession"("userId", "updatedAt" DESC);

-- 2. ModerationLog — 审核审计日志
CREATE TABLE IF NOT EXISTS "ModerationLog" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT,
  "type"      TEXT NOT NULL,  -- 'post' | 'comment'
  "action"    TEXT NOT NULL,  -- 'flag' | 'block' | 'warn'
  "text"      TEXT,
  "flags"     JSONB DEFAULT '[]',
  "score"     INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 确保 Post.embedding 列存在（从 Prisma schema 已创建）
-- ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "embedding" JSONB;

-- ═══ Done ═══
-- 验证:
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('ChatSession', 'ModerationLog');
-- → 应返回 2 行
