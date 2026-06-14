-- Phase E: 板块中文显示名
-- 在 Supabase SQL Editor 中执行

-- 1. 添加 displayName 列
ALTER TABLE "Subreddit" ADD COLUMN IF NOT EXISTS "displayName" TEXT;

-- 2. 更新 15 个官方板块的中文显示名
-- 标化考试
UPDATE "Subreddit" SET "displayName" = 'SAT/ACT 备考'     WHERE "name" = 'sat-act';
UPDATE "Subreddit" SET "displayName" = 'AP/学科竞赛'       WHERE "name" = 'ap-olympiad';
UPDATE "Subreddit" SET "displayName" = 'A-Level/IB 课程'   WHERE "name" = 'alevel-ib';
UPDATE "Subreddit" SET "displayName" = '语言考试'           WHERE "name" = 'lang-exams';

-- 申请实战
UPDATE "Subreddit" SET "displayName" = '选校定位'           WHERE "name" = 'school-select';
UPDATE "Subreddit" SET "displayName" = '文书写作'           WHERE "name" = 'essay-writing';
UPDATE "Subreddit" SET "displayName" = '申请策略'           WHERE "name" = 'app-strategy';
UPDATE "Subreddit" SET "displayName" = '背景提升'           WHERE "name" = 'bg-boost';

-- 院校洞见
UPDATE "Subreddit" SET "displayName" = '美国本科'           WHERE "name" = 'us-undergrad';
UPDATE "Subreddit" SET "displayName" = '英联邦留学'         WHERE "name" = 'uk-commonwealth';
UPDATE "Subreddit" SET "displayName" = '欧亚院校'           WHERE "name" = 'eu-asia';

-- 签证与行前
UPDATE "Subreddit" SET "displayName" = '签证移民'           WHERE "name" = 'visa-immigration';
UPDATE "Subreddit" SET "displayName" = '行前准备'           WHERE "name" = 'pre-departure';

-- 留学之后
UPDATE "Subreddit" SET "displayName" = '实习就业'           WHERE "name" = 'career-jobs';
UPDATE "Subreddit" SET "displayName" = '留学生活'           WHERE "name" = 'student-life';
