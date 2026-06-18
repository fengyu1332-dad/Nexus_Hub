import { db } from '@/lib/db'
import { sendWeeklyNewsletter } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * POST /api/newsletter/send
 * 由 n8n Architect 工作流每周定时调用（如每周日 8:00）。
 *
 * 鉴权: 与 AI Webhook 共用同一密钥。
 * Body: { secret_key: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    // 1. 获取本周 AI 文章（兼容 Prisma 和 Supabase REST）
    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)

    const posts = await db.post.findMany({
      where: { createdAt: { gte: weekStart } },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Resolve authors and filter to AI only
    const authorIds = Array.from(new Set((posts || []).map((p: any) => p.authorId).filter(Boolean)))
    const authorMap = new Map()
    for (const aid of authorIds) {
      const u = await db.user.findFirst({
        where: { id: aid },
        select: { id: true, username: true, isAI: true, aiRole: true },
      })
      if (u) authorMap.set(aid, u)
    }

    // Resolve subreddit names
    const subredditIds = Array.from(new Set((posts || []).map((p: any) => p.subredditId).filter(Boolean)))
    const subredditMap = new Map()
    for (const sid of subredditIds) {
      const s = await db.subreddit.findFirst({
        where: { id: sid },
        select: { name: true },
      })
      if (s) subredditMap.set(sid, (s as any).name || 'Nexus')
    }

    const items = (posts || [])
      .filter((p: any) => {
        const author = authorMap.get(p.authorId)
        return author && (author as any).isAI
      })
      .map((p: any) => {
        const author = authorMap.get(p.authorId) || {}
        let summary = ''
        try {
          const content = p.content as { blocks?: { data?: { text?: string } }[] }
          const blocks = content?.blocks || []
          summary =
            blocks
              .map((b: any) => b.data?.text || '')
              .join(' ')
              .replace(/<[^>]+>/g, '')
              .substring(0, 200) || p.title
        } catch {
          summary = p.title
        }
        return {
          title: p.title,
          summary,
          subreddit: subredditMap.get(p.subredditId) || 'Nexus',
          author: (author as any).aiRole || (author as any).username || 'AI',
          postId: p.id,
        }
      })

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: '本周无 AI 新文章' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 2. 获取所有 active 订阅者（含 unsubscribe token）
    const subs = (await db.newsletterSubscriber.findMany({
      where: { active: true },
      select: { email: true, unsubscribeToken: true },
    })) as { email: string; unsubscribeToken?: string }[]

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: '暂无活跃订阅者' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 3. 逐个发送（Resend 免费额度 100/day，足够使用）
    let sent = 0
    let failed = 0
    for (const sub of subs) {
      const ok = await sendWeeklyNewsletter(sub.email, items, sub.unsubscribeToken)
      if (ok) sent++
      else failed++
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        totalSubscribers: subs.length,
        postsIncluded: items.length,
        weekStart: weekStart.toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[newsletter/send] Error:', error)
    return new Response(
      JSON.stringify({ error: '发送失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
