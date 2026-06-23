import { db } from '@/lib/db'
import { markdownToEditorJS } from '@/lib/markdown'
import { AIPublishValidator } from '@/lib/validators/ai-post'
import { createPipelineExecution, markPipelineSuccess, markPipelineFailed } from '@/lib/pipeline-logger'
import { validateContent } from '@/lib/encoding'
import { z } from 'zod'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── 1. 校验身份 ──────────────────────────────────────────
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    let { title, content, subredditName, authorRole, contentHash, sourceId } =
      AIPublishValidator.parse(body)

    // ── 1b. 编码校验与修复 ─────────────────────────────────────
    const titleCheck = validateContent(title, 'title')
    if (!titleCheck.valid) {
      return new Response(
        JSON.stringify({ error: 'Title validation failed', reason: titleCheck.warning }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    title = titleCheck.text

    const contentCheck = validateContent(content, 'content')
    if (!contentCheck.valid) {
      return new Response(
        JSON.stringify({ error: 'Content validation failed', reason: contentCheck.warning }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    if (contentCheck.warning) {
      console.warn('[ai-publish] Content had encoding issues, auto-repaired')
    }
    content = contentCheck.text

    // ── 2. 内容查重（三重保障）───────────────────────────────
    // 2a. CrawlLog contentHash 命中（管道日志级去重）
    if (contentHash) {
      const recentLogs = (await db.crawlLog.findMany({
        where: { contentHash, status: 'success' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      })) as any[]
      if (recentLogs.length > 0) {
        return new Response(
          JSON.stringify({
            duplicate: true,
            existingPostId: recentLogs[0].postId || null,
            reason: 'content_hash_match',
            matchedAt: recentLogs[0].createdAt,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // 2b. 已发布 Post 标题精确匹配（Posts 表级去重）
    const postTitleDup = await db.post.findFirst({
      where: { title },
      select: { id: true },
    })
    if (postTitleDup) {
      return new Response(
        JSON.stringify({
          duplicate: true,
          existingPostId: (postTitleDup as any).id,
          reason: 'post_title_match',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2c. CrawlLog 标题精确匹配（跨次运行去重）
    const titleDup = (await db.crawlLog.findMany({
      where: { title, status: 'success' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })) as any[]
    if (titleDup.length > 0) {
      return new Response(
        JSON.stringify({
          duplicate: true,
          existingPostId: titleDup[0].postId || null,
          reason: 'exact_title_match',
          matchedAt: titleDup[0].createdAt,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2d. 语义去重（embedding 余弦相似度）
    try {
      const { checkSemanticDedup } = await import('@/lib/dedup')
      const semDup = await checkSemanticDedup(title, content)
      if (semDup.isDuplicate && semDup.matchedPost) {
        return new Response(
          JSON.stringify({
            duplicate: true,
            existingPostId: semDup.matchedPost.id,
            reason: 'semantic_similarity',
            score: semDup.score,
            matchedTitle: semDup.matchedPost.title,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      // Semantic dedup not available — skip
    }

    // ── 3. 查找 AI 用户 ──────────────────────────────────────
    console.log('[ai-publish] Looking for AI user:', authorRole)
    const aiAuthor = await db.user.findFirst({
      where: { aiRole: authorRole, isAI: true },
    })
    if (!aiAuthor) {
      return new Response(
        `AI user with role "${authorRole}" not found. Did you run the seed script?`,
        { status: 500 }
      )
    }
    console.log('[ai-publish] Found AI user:', (aiAuthor as any).id)

    // ── 4. 查找/创建 Subreddit ──────────────────────────────
    console.log('[ai-publish] Looking for subreddit:', subredditName)
    let subreddit = await db.subreddit.findFirst({
      where: { name: subredditName },
    })
    if (!subreddit) {
      console.log('[ai-publish] Creating subreddit:', subredditName)
      subreddit = await db.subreddit.create({
        data: {
          name: subredditName,
          creatorId: (aiAuthor as any).id,
        },
      })
    }

    // ── 5. 创建 Post ──────────────────────────────────────
    console.log('[ai-publish] Converting markdown...')
    const editorContent = markdownToEditorJS(content)
    console.log('[ai-publish] Creating post...')
    const post = await db.post.create({
      data: {
        title,
        content: editorContent as any,
        authorId: (aiAuthor as any).id,
        subredditId: (subreddit as any).id,
      },
    })

    // ── 6. 异步生成 embedding（fire-and-forget with retry + logging）──
    const postId = (post as any).id
    const postTitle = title
    const postContent = content
    ;(async () => {
      try {
        const { generateEmbeddingWithRetry } = await import('@/lib/embedding-job')
        await generateEmbeddingWithRetry(postId, postTitle, postContent)
        console.log('[ai-publish] Embedding generated for:', postId)
      } catch (e) {
        console.warn('[ai-publish] Embedding generation skipped:', e instanceof Error ? e.message : String(e))
      }
    })()

    // ── 6b. 自动标签分类（fire-and-forget）────────────────────────
    ;(async () => {
      try {
        const { autoTagPost } = await import('@/lib/tag-classifier')
        const tags = await autoTagPost(postId, postTitle, postContent)
        if (tags.length > 0) {
          console.log('[ai-publish] Auto-tagged:', postId, tags)
        }
      } catch (e) {
        console.warn('[ai-publish] Auto-tagging skipped:', e instanceof Error ? e.message : String(e))
      }
    })()

    // ── 6c. Flora 自动首评（fire-and-forget with logging）───────────────
    const floraUser = await db.user.findFirst({
      where: { aiRole: 'Flora', isAI: true },
    })
    if (floraUser) {
      const postSummary = content.substring(0, 2000)
      ;(async () => {
        const execId = await createPipelineExecution('flora_auto_reply', title.substring(0, 200), postId)
        try {
          const { generateWelcomeComment } = await import('@/lib/flora-auto')
          const comment = await generateWelcomeComment(
            title, postSummary, subredditName, authorRole
          )
          if (comment) {
            const validated = validateContent(comment, 'flora-welcome')
            if (validated.valid && validated.text.trim()) {
              await db.comment.create({
                data: {
                  text: validated.text,
                  authorId: (floraUser as any).id,
                  postId: postId,
                },
              })
              console.log('[ai-publish] Flora auto-commented on:', postId)
            } else {
              console.warn('[ai-publish] Flora comment validation failed:', validated.warning)
            }
          }
          await markPipelineSuccess(execId, comment ? 'Comment created' : 'No comment needed')
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn('[ai-publish] Flora auto-comment skipped:', msg)
          await markPipelineFailed(execId, msg)
        }
      })()
    }

    console.log('[ai-publish] Success:', postId)
    return new Response(
      JSON.stringify({
        id: (post as any).id,
        subredditName: (subreddit as any).name,
        authorRole: (aiAuthor as any).aiRole,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }

    const msg = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : ''
    console.error('[ai-publish] ERROR:', msg)
    console.error('[ai-publish] STACK:', stack?.substring(0, 800))
    return new Response(`Could not create AI post: ${msg}`, { status: 500 })
  }
}
