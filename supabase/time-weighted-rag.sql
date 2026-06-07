-- =============================================================================
-- Nexus Hub — 时间加权向量检索函数 (Time-Weighted RAG)
-- =============================================================================
-- 文件: supabase/time-weighted-rag.sql
-- 执行方式: 在 Supabase SQL Editor 中直接粘贴运行
--
-- 解决的问题: 旧政策文章污染 RAG 检索结果
-- 策略: 语义相似度 × 时间衰减系数 = 最终得分
--
-- 时间衰减算法:
--   - 0-3 个月 (0-90 天):      衰减系数 = 1.0        (全新内容，满分)
--   - 3-12 个月 (91-365 天):   衰减系数 = 1.0→0.5   (线性衰减)
--   - 12 个月以上 (>365 天):   衰减系数 = 0.5       (封底，不再继续衰减)
--
-- 线性衰减公式:
--   months_ago = days_ago / 30.0
--   IF months_ago <= 3:  factor = 1.0
--   ELIF months_ago <= 12: factor = 1.0 - (months_ago - 3) / 9.0 * 0.5
--   ELSE: factor = 0.5
--
-- 最终得分公式:
--   final_score = cosine_similarity(query_vector, post_embedding) * time_decay_factor
-- =============================================================================

-- ── 辅助函数 1: 计算两个 JSONB 数组的余弦相似度 ─────────────────
-- 输入: a = '[0.1, 0.2, ...]'::jsonb, b = '[0.3, 0.4, ...]'::jsonb
-- 输出: cosine_similarity ∈ [-1, 1]

CREATE OR REPLACE FUNCTION cosine_similarity_jsonb(a jsonb, b jsonb)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    dot_product float := 0;
    norm_a float := 0;
    norm_b float := 0;
    len_a int;
    len_b int;
    i int;
    val_a float;
    val_b float;
BEGIN
    len_a := jsonb_array_length(a);
    len_b := jsonb_array_length(b);

    -- 维度不匹配时返回 0
    IF len_a != len_b OR len_a = 0 THEN
        RETURN 0;
    END IF;

    -- 逐元素计算点积和范数
    FOR i IN 0..len_a-1 LOOP
        val_a := (a->>i)::float;
        val_b := (b->>i)::float;
        dot_product := dot_product + (val_a * val_b);
        norm_a := norm_a + (val_a * val_a);
        norm_b := norm_b + (val_b * val_b);
    END LOOP;

    -- 防止除零
    IF norm_a = 0 OR norm_b = 0 THEN
        RETURN 0;
    END IF;

    RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$;

-- ── 辅助函数 2: 计算时间衰减系数 ───────────────────────────────

CREATE OR REPLACE FUNCTION time_decay_factor(created_at timestamptz)
RETURNS float
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    days_ago float;
    months_ago float;
    factor float;
BEGIN
    days_ago := EXTRACT(EPOCH FROM (now() - created_at)) / 86400.0;
    months_ago := days_ago / 30.0;

    IF months_ago <= 3 THEN
        factor := 1.0;
    ELSIF months_ago <= 12 THEN
        -- 线性衰减: 从 1.0 (3个月) 到 0.5 (12个月)
        factor := 1.0 - ((months_ago - 3.0) / 9.0) * 0.5;
    ELSE
        factor := 0.5;  -- 封底: 超过 1 年的文章保持在 0.5
    END IF;

    RETURN factor;
END;
$$;

-- ── 主函数: 时间加权语义检索 ──────────────────────────────────
-- 输入:
--   query_embedding: 查询文本的向量 (jsonb 数组, 如 '[0.1,0.2,...]')
--   top_k: 返回最相似的 K 篇文章 (默认 5)
--   min_similarity: 最低相似度阈值 (默认 0.3，过滤不相关内容)
-- 输出: TABLE(post_id, title, content_preview, cosine_sim, time_factor, final_score)

CREATE OR REPLACE FUNCTION match_posts_time_weighted(
    query_embedding jsonb,
    top_k int DEFAULT 5,
    min_similarity float DEFAULT 0.3
)
RETURNS TABLE(
    id text,
    title text,
    content_preview text,
    cosine_similarity float,
    time_factor float,
    final_score float,
    days_ago int
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    rec record;
    cos_sim float;
    t_factor float;
    f_score float;
BEGIN
    -- 创建临时表存储中间结果
    CREATE TEMP TABLE IF NOT EXISTS _match_results (
        post_id text,
        post_title text,
        post_content text,
        cos_sim float,
        t_factor float,
        final_score float,
        d_ago int
    ) ON COMMIT DROP;

    DELETE FROM _match_results;

    -- 遍历所有有 embedding 的帖子
    FOR rec IN
        SELECT "id", "title", "content", "embedding", "createdAt"
        FROM "Post"
        WHERE "embedding" IS NOT NULL
    LOOP
        -- 计算余弦相似度
        cos_sim := cosine_similarity_jsonb(query_embedding, rec."embedding");

        -- 过滤低于阈值的
        IF cos_sim < min_similarity THEN
            CONTINUE;
        END IF;

        -- 计算时间衰减系数
        t_factor := time_decay_factor(rec."createdAt");

        -- 最终得分 = 语义相似度 × 时间新鲜度
        f_score := cos_sim * t_factor;

        INSERT INTO _match_results VALUES (
            rec."id",
            rec."title",
            substring(rec."content"::text, 1, 300),
            cos_sim,
            t_factor,
            f_score,
            EXTRACT(DAY FROM (now() - rec."createdAt"))::int
        );
    END LOOP;

    -- 返回 Top-K 结果
    RETURN QUERY
        SELECT
            m.post_id,
            m.post_title,
            m.post_content,
            m.cos_sim,
            m.t_factor,
            m.final_score,
            m.d_ago
        FROM _match_results m
        ORDER BY m.final_score DESC
        LIMIT top_k;

    DROP TABLE IF EXISTS _match_results;
END;
$$;

-- ── 使用示例 ──────────────────────────────────────────────────
-- 假设你已有查询 embedding '[0.01, -0.02, 0.03, ...]'
--
-- SELECT * FROM match_posts_time_weighted(
--     '[0.01, -0.02, 0.03, ...]'::jsonb,
--     5,   -- top 5
--     0.3  -- min similarity
-- );
--
-- 返回示例:
--   id          | title            | cosine_similarity | time_factor | final_score | days_ago
--   cmq3...     | 2026 A-Level指南 | 0.85              | 0.92        | 0.782       | 120
--   cmq2...     | 牛剑申请攻略     | 0.78              | 0.50        | 0.390       | 400
--   ↑ 尽管第二篇语义相关度高，但因为是一年前的文章，得分被大幅衰减
-- =============================================================================

-- ── 性能说明 ──────────────────────────────────────────────────
-- 当前方案遍历所有带 embedding 的行，适用于 <10,000 篇文章。
-- 当文章数 >10,000 时，建议启用 pgvector 扩展并使用 IVFFlat 索引。
-- pgvector 迁移路径:
--   1. CREATE EXTENSION vector;
--   2. ALTER TABLE "Post" ADD COLUMN embedding_vec vector(1536);
--   3. UPDATE "Post" SET embedding_vec = embedding::text::vector;
--   4. 使用 pgvector 的 <-> 运算符替代手动余弦计算
-- =============================================================================
