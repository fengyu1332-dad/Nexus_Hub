import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // ── 鉴权 ──────────────────────────────────────────
    const secretKey = req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    // ── 解析参数 ──────────────────────────────────────
    const { searchParams } = new URL(req.url)
    const days = Math.min(parseInt(searchParams.get('days') || '7') || 7, 90)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 200)
    const since = new Date()
    since.setDate(since.getDate() - days)

    // ── 查询 AI 用户 ──────────────────────────────────
    const aiUsers = await db.user.findMany({
      where: { isAI: true },
      select: { id: true },
    })
    const aiUserIds = (aiUsers || []).map((u: any) => u.id)

    if (aiUserIds.length === 0) {
      return new Response(JSON.stringify({ posts: [], meta: { days, limit } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── 查询 AI 帖子 ──────────────────────────────────
    let posts: any[] = []
    try {
      posts = await db.post.findMany({
        orderBy: { voteCount: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          voteCount: true,
          createdAt: true,
          subredditId: true,
          authorId: true,
        },
      })
      // Filter manually for AI authors and date range
      posts = (posts || [])
        .filter((p: any) => aiUserIds.includes(p.authorId))
        .filter((p: any) => new Date(p.createdAt) >= since)
        .slice(0, limit)
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch posts' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Batch-resolve subreddit names ──────────────────
    const subIds = [...new Set(posts.map((p: any) => p.subredditId))]
    const subMap = new Map<string, string>()
    for (const sid of subIds) {
      try {
        const sub = await db.subreddit.findFirst({
          where: { id: sid },
          select: { name: true },
        })
        if (sub) subMap.set(sid, (sub as any).name)
      } catch { /* skip */ }
    }

    const result = posts.map((p: any) => ({
      id: p.id,
      title: p.title,
      voteCount: p.voteCount ?? 0,
      createdAt: p.createdAt,
      subredditName: subMap.get(p.subredditId) || 'Nexus',
      url: `/r/${subMap.get(p.subredditId) || 'Nexus'}/post/${p.id}`,
    }))

    return new Response(
      JSON.stringify({ posts: result, meta: { days, limit } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[ai-feedback] Error:', error)
    return new Response('Could not retrieve AI feedback', { status: 500 })
  }
}
