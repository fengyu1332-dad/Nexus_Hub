-- =============================================================================
-- RLS Policies Fix — Allow INSERT/UPDATE/DELETE for anon key
-- =============================================================================
-- These tables have RLS enabled but lack permissive write policies.
-- Since auth is handled at the NextAuth level (not Supabase Auth),
-- we use permissive policies that allow all operations.
-- Run this in Supabase SQL Editor.
-- =============================================================================

-- === STEP 1: Grant table-level permissions to anon role ===
-- RLS policies alone are not enough; the anon role also needs
-- explicit GRANT at the table level to perform write operations.
GRANT INSERT, UPDATE, DELETE ON "Vote" TO anon;
GRANT INSERT, DELETE ON "Bookmark" TO anon;
GRANT INSERT ON "Report" TO anon;
GRANT INSERT, UPDATE ON "PostFeedback" TO anon;
GRANT INSERT, UPDATE, DELETE ON "CommentVote" TO anon;

-- === STEP 2: RLS policies for all operations (SELECT + write) ===
-- The Supabase JS SDK uses .insert().select().single() pattern which
-- performs a SELECT after write. Without SELECT policies, the write
-- succeeds but the follow-up SELECT fails with 42501.

-- 1. Vote table (post voting)
DROP POLICY IF EXISTS "Allow all selects on Vote" ON "Vote";
CREATE POLICY "Allow all selects on Vote" ON "Vote" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all inserts on Vote" ON "Vote";
CREATE POLICY "Allow all inserts on Vote" ON "Vote" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all updates on Vote" ON "Vote";
CREATE POLICY "Allow all updates on Vote" ON "Vote" FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow all deletes on Vote" ON "Vote";
CREATE POLICY "Allow all deletes on Vote" ON "Vote" FOR DELETE USING (true);

-- 2. Bookmark table (save/unsave posts)
DROP POLICY IF EXISTS "Allow all selects on Bookmark" ON "Bookmark";
CREATE POLICY "Allow all selects on Bookmark" ON "Bookmark" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all inserts on Bookmark" ON "Bookmark";
CREATE POLICY "Allow all inserts on Bookmark" ON "Bookmark" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all deletes on Bookmark" ON "Bookmark";
CREATE POLICY "Allow all deletes on Bookmark" ON "Bookmark" FOR DELETE USING (true);

-- 3. Report table (report posts/comments)
DROP POLICY IF EXISTS "Allow all selects on Report" ON "Report";
CREATE POLICY "Allow all selects on Report" ON "Report" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all inserts on Report" ON "Report";
CREATE POLICY "Allow all inserts on Report" ON "Report" FOR INSERT WITH CHECK (true);

-- 4. PostFeedback table (AI feedback)
DROP POLICY IF EXISTS "Allow all selects on PostFeedback" ON "PostFeedback";
CREATE POLICY "Allow all selects on PostFeedback" ON "PostFeedback" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all inserts on PostFeedback" ON "PostFeedback";
CREATE POLICY "Allow all inserts on PostFeedback" ON "PostFeedback" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all updates on PostFeedback" ON "PostFeedback";
CREATE POLICY "Allow all updates on PostFeedback" ON "PostFeedback" FOR UPDATE USING (true);

-- 5. CommentVote table (comment voting)
DROP POLICY IF EXISTS "Allow all selects on CommentVote" ON "CommentVote";
CREATE POLICY "Allow all selects on CommentVote" ON "CommentVote" FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow all inserts on CommentVote" ON "CommentVote";
CREATE POLICY "Allow all inserts on CommentVote" ON "CommentVote" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all updates on CommentVote" ON "CommentVote";
CREATE POLICY "Allow all updates on CommentVote" ON "CommentVote" FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow all deletes on CommentVote" ON "CommentVote";
CREATE POLICY "Allow all deletes on CommentVote" ON "CommentVote" FOR DELETE USING (true);
