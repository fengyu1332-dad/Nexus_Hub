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

    const { title, content, subredditName, authorRole } =
      AIPublishValidator.parse(body)

    // ── 2. 查找/创建对应的 Subreddit ──────────────────────────
    const aiAuthor = await db.user.findFirst({
      where: { aiRole: authorRole, isAI: true },
    })
    if (!aiAuthor) {
      return new Response(
        `AI user with role "${authorRole}" not found. Did you run the seed script?`,
        { status: 500 }
      )
    }

    let subreddit = await db.subreddit.findFirst({
      where: { name: subredditName },
    })
    if (!subreddit) {
      subreddit = await db.subreddit.create({
        data: {
          name: subredditName,
          creatorId: aiAuthor.id,
        },
      })
    }

    // ── 3. 调用 Prisma 创建 Post 记录 ─────────────────────────
    const editorContent = markdownToEditorJS(content)

    const post = await db.post.create({
      data: {
        title,
        // Prisma Json field needs explicit any cast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: editorContent as any,
        authorId: aiAuthor.id,
        subredditId: subreddit.id,
      },
    })

    // ── 4. 返回 200 成功状态 ─────────────────────────────────
    return new Response(
      JSON.stringify({
        id: post.id,
        subredditName: subreddit.name,
        authorRole: aiAuthor.aiRole,
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

    console.error('[ai-publish] Unexpected error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not create AI post at this time', { status: 500 })
  }
}
