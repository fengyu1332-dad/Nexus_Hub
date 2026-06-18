import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function extractText(content: unknown): string {
  if (!content) return ''
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    const blocks = (parsed as any)?.blocks
    if (!Array.isArray(blocks)) return ''
    return blocks
      .map((b: any) => b.data?.text || '')
      .join(' ')
      .replace(/<[^>]+>/g, '')
  } catch {
    return typeof content === 'string' ? content : ''
  }
}

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    // Get this week's start (last Sunday)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)

    // Fetch AI-generated posts this week
    const posts = await db.post.findMany({
      where: { createdAt: { gte: weekStart.toISOString() } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
    })

    // Resolve authors and subreddits
    const authorIds = Array.from(new Set(posts.map((p: any) => p.authorId).filter(Boolean)))
    const subIds = Array.from(new Set(posts.map((p: any) => p.subredditId).filter(Boolean)))
    const authorMap = new Map()
    const subMap = new Map()

    if (authorIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, isAI: true, aiRole: true },
      })
      for (const u of users) authorMap.set(u.id, u)
    }
    if (subIds.length > 0) {
      const subs = await db.subreddit.findMany({
        where: { id: { in: subIds } },
        select: { id: true, name: true, displayName: true },
      })
      for (const s of subs) subMap.set(s.id, s)
    }

    const enriched = posts.map((p: any) => {
      const author = authorMap.get(p.authorId) || { username: 'Unknown', isAI: false, aiRole: null }
      const sub = subMap.get(p.subredditId) || { name: 'Nexus', displayName: null }
      return {
        id: p.id,
        title: p.title,
        excerpt: extractText(p.content).substring(0, 200),
        createdAt: p.createdAt,
        author: { username: author.username, isAI: author.isAI, aiRole: author.aiRole },
        subredditName: sub.name,
        subredditDisplayName: sub.displayName,
      }
    })

    // Get subscriber stats
    let subscriberCount = 0
    let activeCount = 0
    try {
      const allSubs = await db.newsletterSubscriber.findMany({
        select: { active: true, confirmed: true },
      })
      subscriberCount = allSubs.length
      activeCount = allSubs.filter((s: any) => s.active).length
    } catch {
      // Table may not exist
    }

    return new Response(JSON.stringify({
      weekStart: weekStart.toISOString(),
      totalPosts: enriched.length,
      aiPosts: enriched.filter((p: any) => p.author?.isAI).length,
      subscriberCount,
      activeCount,
      posts: enriched,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Preview failed: ' + (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
