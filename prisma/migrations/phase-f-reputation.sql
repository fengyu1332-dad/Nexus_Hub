-- Phase F: 用户成长体系 — 声誉积分与等级
-- 在 Supabase SQL Editor 中执行

-- 1. 添加 reputation/level/createdAt 列
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reputation" INTEGER DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "level" INTEGER DEFAULT 1;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();

-- 2. 为现有用户初始化默认值
UPDATE "User" SET "reputation" = 0 WHERE "reputation" IS NULL;
UPDATE "User" SET "level" = 1 WHERE "level" IS NULL;
UPDATE "User" SET "createdAt" = NOW() WHERE "createdAt" IS NULL;

-- 3. 添加索引
CREATE INDEX IF NOT EXISTS "idx_user_reputation" ON "User"("reputation" DESC);
