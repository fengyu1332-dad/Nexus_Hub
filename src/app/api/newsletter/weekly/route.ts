import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/newsletter/weekly
 * 返回本周所有 AI 生成的文章，供 The Architect 汇编周报。
 */
export async function GET() {
  try {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysSinceLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - daysSinceLastSunday)
    weekStart.setHours(0, 0, 0, 0)

    const posts = await db.post.findMany({
      where: {
        createdAt: { gte: weekStart },
        author: { isAI: true },
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        subreddit: { select: { name: true } },
        author: { select: { username: true, aiRole: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // 提取纯文本摘要
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
      return {
        id: p.id,
        title: p.title,
        summary: text,
        subreddit: p.subreddit.name,
        author: `${p.author.aiRole || p.author.username}`,
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
