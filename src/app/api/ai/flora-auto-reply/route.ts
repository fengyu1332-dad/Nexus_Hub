import { db } from '@/lib/db'
import { shouldReplyToComment } from '@/lib/flora-auto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/flora-auto-reply
 * 由 n8n 定时触发（如每 30 分钟），扫描无回复评论并让 Flora 自动回复。
 *
 * 鉴权: x-api-key 或 body.secret_key = AI_WEBHOOK_SECRET
 * Body: { secret_key?: string, maxComments?: number, maxReplies?: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const maxCheck = Math.min(body.maxComments || 10, 30)
    const maxReply = Math.min(body.maxReplies || 3, 10)

    // 1. 找到 Flora 用户
    const floraUser = await db.user.findFirst({
      where: { aiRole: 'Flora', isAI: true },
      select: { id: true },
    }) as { id: string } | null

    if (!floraUser) {
      return new Response(
        JSON.stringify({ replied: 0, message: 'Flora user not found' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. 获取最近的评论（排除 Flora 自己的评论）
    const recentComments = await db.comment.findMany({
      take: maxCheck * 2,
      orderBy: { createdAt: 'desc' },
      where: {
        authorId: { not: floraUser.id },
      },
      select: {
        id: true,
        text: true,
        authorId: true,
        postId: true,
      },
    })

    // 2b. 过滤掉已有回复的评论（Supabase REST 不支持 relation none 查询）
    const commentIds = recentComments.map((c: any) => c.id)
    const repliedIds = new Set(
      (
        (await db.comment.findMany({
          where: { replyToId: { in: commentIds } },
          select: { replyToId: true },
        })) as { replyToId: string | null }[]
      )
        .filter((c) => c.replyToId)
        .map((c) => c.replyToId!)
    )
    const unreplied = recentComments
      .filter((c: any) => !repliedIds.has(c.id))
      .slice(0, maxCheck)

    if (!unreplied || unreplied.length === 0) {
      return new Response(
        JSON.stringify({ replied: 0, message: 'No comments to check' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. 批量获取关联的 post 信息和作者信息
    const postIds = Array.from(new Set(unreplied.map((c: any) => c.postId))) as string[]
    const authorIds = Array.from(new Set(unreplied.map((c: any) => c.authorId))) as string[]

    const postMap = new Map<string, { title: string; content: unknown }>()
    for (const pid of postIds) {
      const p = await db.post.findFirst({
        where: { id: pid },
        select: { title: true, content: true },
      })
      if (p) postMap.set(pid, p as any)
    }

    const authorMap = new Map<string, string>()
    for (const aid of authorIds) {
      const u = await db.user.findFirst({
        where: { id: aid },
        select: { username: true },
      })
      if (u) authorMap.set(aid, (u as any).username || 'unknown')
    }

    // 4. 逐个检查并回复
    let replyCount = 0
    const results: { commentId: string; replied: boolean; reason: string }[] = []

    for (const comment of unreplied) {
      if (replyCount >= maxReply) break

      const post = postMap.get((comment as any).postId)
      if (!post) continue

      const decision = await shouldReplyToComment({
        commentId: (comment as any).id,
        postTitle: (post as any).title || '',
        postContent: typeof (post as any).content === 'string'
          ? (post as any).content
          : JSON.stringify((post as any).content),
        commentText: (comment as any).text || '',
        authorUsername: authorMap.get((comment as any).authorId) || 'unknown',
      })

      results.push({
        commentId: (comment as any).id,
        replied: decision.shouldReply,
        reason: decision.reason,
      })

      if (decision.shouldReply && decision.reply) {
        try {
          await db.comment.create({
            data: {
              text: decision.reply,
              authorId: floraUser.id,
              postId: (comment as any).postId,
              replyToId: (comment as any).id,
            },
          })
          replyCount++
          console.log('[flora-auto-reply] Replied to comment:', (comment as any).id)
        } catch (e) {
          console.warn('[flora-auto-reply] Failed to create reply:', e)
        }
      }
    }

    return new Response(
      JSON.stringify({
        replied: replyCount,
        checked: unreplied.length,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[flora-auto-reply] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Auto-reply failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
