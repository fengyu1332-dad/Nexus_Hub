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
    let autoCommentCount = 0

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
          subId = (sub as any).id as string
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

        const postId = (post as any).id
        results.push({ title: item.title, ok: true, id: postId })

        // Fire-and-forget: Flora auto-comment (max 5 per batch)
        if (autoCommentCount < 5) {
          autoCommentCount++
          const sName = item.subredditName
          const aRole = item.authorRole
          ;(async () => {
            try {
              const floraUser = await db.user.findFirst({
                where: { aiRole: 'Flora', isAI: true },
              })
              if (!floraUser) return
              const { generateWelcomeComment } = await import('@/lib/flora-auto')
              const comment = await generateWelcomeComment(
                item.title, item.content.substring(0, 2000), sName, aRole
              )
              if (comment) {
                await db.comment.create({
                  data: {
                    text: comment,
                    authorId: (floraUser as any).id,
                    postId: postId,
                  },
                })
              }
            } catch { /* non-critical */ }
          })()
        }

        // Fire-and-forget embedding generation
        const postTitle = item.title
        const postContent = item.content
        ;(async () => {
          try {
            const { getEmbedding } = await import('@/lib/embedding')
            const embedding = await getEmbedding(
              (postTitle + ' ' + postContent).substring(0, 8000)
            )
            if (embedding && embedding.length > 0) {
              await db.post.update({
                where: { id: postId },
                data: { embedding: embedding as any },
              })
            }
          } catch {
            // non-critical — skip
          }
        })()
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
