import { db } from '@/lib/db'
import { markdownToEditorJS } from '@/lib/markdown'
import { AIPublishValidator } from '@/lib/validators/ai-post'
import { z } from 'zod'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── 1. 校验身份 ──────────────────────────────────────────
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { title, content, subredditName, authorRole, contentHash, sourceId } =
      AIPublishValidator.parse(body)

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

    console.log('[ai-publish] Success:', (post as any).id)
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
