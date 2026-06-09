import { db } from '@/lib/db'
import { markdownToEditorJS } from '@/lib/markdown'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const BatchPublishValidator = z.object({
  secret_key: z.string().optional(),
  posts: z
    .array(
      z.object({
        title: z.string().min(3).max(128),
        content: z.string().min(1),
        subredditName: z.string().min(3).max(21),
        authorRole: z.enum(['Newton', 'Midas', 'Flora']),
      })
    )
    .min(1)
    .max(50),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── 1. 校验身份 ──────────────────────────────────────────
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { posts: items } = BatchPublishValidator.parse(body)

    // ── 2. 预加载 AI 用户 ──────────────────────────────────
    const aiUsers = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, aiRole: true },
    })) as any[]
    const aiUserMap = new Map(aiUsers.map((u: any) => [u.aiRole, u]))

    // ── 3. 预加载 subreddit ──────────────────────────────────
    const subMap = new Map<string, string>() // name → id
    const results: { title: string; ok: boolean; id?: string; error?: string }[] = []

    for (const item of items) {
      try {
        // Find or get cached AI user
        const aiAuthor = aiUserMap.get(item.authorRole)
        if (!aiAuthor) {
          results.push({ title: item.title, ok: false, error: `AI role "${item.authorRole}" not found` })
          continue
        }

        // Find or create subreddit
        let subId = subMap.get(item.subredditName)
        if (!subId) {
          let sub = await db.subreddit.findFirst({
            where: { name: item.subredditName },
          })
          if (!sub) {
            sub = await db.subreddit.create({
              data: {
                name: item.subredditName,
                creatorId: aiAuthor.id,
              },
            })
          }
          subId = (sub as any).id
          subMap.set(item.subredditName, subId)
        }

        const editorContent = markdownToEditorJS(item.content)
        const post = await db.post.create({
          data: {
            title: item.title,
            content: editorContent as any,
            authorId: aiAuthor.id,
            subredditId: subId,
          },
        })

        results.push({ title: item.title, ok: true, id: (post as any).id })
      } catch (err: any) {
        results.push({ title: item.title, ok: false, error: err.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
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
    console.error('[ai-publish-batch] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not batch publish AI posts', { status: 500 })
  }
}
