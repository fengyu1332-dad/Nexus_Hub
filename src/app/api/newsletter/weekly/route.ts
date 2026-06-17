import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/newsletter/weekly
 * 返回本周所有 AI 生成的文章，供 The Architect 汇编周报。
 * 鉴权: x-api-key 或 ?secret_key=xxx
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secretKey = searchParams.get('secret_key') || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    const weekStartISO = weekStart.toISOString()

    // 1. 获取 AI 用户 ID 列表（Supabase REST 不支持嵌套 relation 过滤）
    const aiUsers = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, username: true, aiRole: true },
    })) as { id: string; username: string; aiRole: string | null }[]
    const aiUserIds = aiUsers.map((u) => u.id)
    const authorMap = new Map(aiUsers.map((u) => [u.id, { username: u.username, aiRole: u.aiRole }]))

    if (aiUserIds.length === 0) {
      return new Response(
        JSON.stringify({ weekStart: weekStart.toISOString(), generatedAt: now.toISOString(), total: 0, posts: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. 查询本周 AI 帖子
    const posts = (await db.post.findMany({
      where: {
        createdAt: { gte: weekStartISO },
        authorId: { in: aiUserIds },
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        subredditId: true,
        authorId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })) as { id: string; title: string; content: unknown; createdAt: Date; subredditId: string; authorId: string }[]

    // 3. 批量解析 subreddit 名称
    const subIds = Array.from(new Set(posts.map((p) => p.subredditId)))
    const subMap = new Map<string, string>()
    for (const sid of subIds) {
      const s = await db.subreddit.findFirst({
        where: { id: sid },
        select: { name: true },
      })
      if (s) subMap.set(sid, (s as any).name || 'Unknown')
    }

    // 4. 提取纯文本摘要
    const summaries = posts.map((p) => {
      let text = ''
      try {
        const content = p.content as { blocks?: { data?: { text?: string } }[] }
        const blocks = content?.blocks || []
        text =
          blocks
            .map((b) => b.data?.text || '')
            .join(' ')
            .replace(/<[^>]+>/g, '')
            .substring(0, 300) || p.title
      } catch {
        text = p.title
      }
      const author = authorMap.get(p.authorId)
      return {
        id: p.id,
        title: p.title,
        summary: text,
        subreddit: subMap.get(p.subredditId) || 'Unknown',
        author: `${author?.aiRole || author?.username || 'AI'}`,
        createdAt: p.createdAt,
      }
    })

    return new Response(
      JSON.stringify({
        weekStart: weekStart.toISOString(),
        generatedAt: now.toISOString(),
        total: summaries.length,
        posts: summaries,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[newsletter/weekly] Error:', error)
    return new Response(
      JSON.stringify({ posts: [], error: 'Failed to fetch weekly posts' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
