import { db } from '@/lib/db'
import {
  checkRateLimit,
  getClientIP,
  rateLimitResponse,
} from '@/lib/rate-limiter'

function extractTextFromContent(content: unknown): string {
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

// Simple search-specific rate limiter (more generous than chat)
const searchRateMap = new Map<string, { count: number; resetAt: number }>()
function checkSearchLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  let entry = searchRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 }
    searchRateMap.set(ip, entry)
  }
  if (entry.count >= 30) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: 30 - entry.count }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')
  const type = url.searchParams.get('type') || 'all'

  if (!q || q.length < 1) return new Response('Invalid query', { status: 400 })

  // Rate limit for search
  const ip = getClientIP(req)
  const limit = checkSearchLimit(ip)
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', message: '搜索太频繁，请稍后再试' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const results: any = { communities: [], posts: [] }

  // Search communities (always)
  if (type === 'communities' || type === 'all') {
    try {
      results.communities = await db.subreddit.findMany({
        where: { name: { startsWith: q } },
        include: { _count: true },
        take: 5,
      })
    } catch {
      results.communities = []
    }
  }

  // Search posts by title + content
  if (type === 'posts' || type === 'all') {
    try {
      const keyword = q.toLowerCase()
      const allPosts = await db.post.findMany({
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

      // Filter in memory
      const matched = (allPosts || [])
        .filter((p: any) => {
          const title = (p.title || '').toLowerCase()
          const body = extractTextFromContent(p.content).toLowerCase()
          return title.includes(keyword) || body.includes(keyword)
        })
        .slice(0, 8)

      // Resolve authors and subreddits
      const authorIds = [...new Set(matched.map((p: any) => p.authorId).filter(Boolean))]
      const subIds = [...new Set(matched.map((p: any) => p.subredditId).filter(Boolean))]
      const authorMap = new Map()
      const subMap = new Map()
      for (const id of authorIds) {
        const u = await db.user.findFirst({ where: { id }, select: { username: true, isAI: true, aiRole: true } })
        if (u) authorMap.set(id, u)
      }
      for (const id of subIds) {
        const s = await db.subreddit.findFirst({ where: { id }, select: { name: true } })
        if (s) subMap.set(id, (s as any).name)
      }

      results.posts = matched.map((p: any) => {
        const excerpt = extractTextFromContent(p.content).substring(0, 200)
        return {
          id: p.id,
          title: p.title,
          excerpt,
          createdAt: p.createdAt,
          author: authorMap.get(p.authorId) || { username: 'Unknown' },
          subredditName: subMap.get(p.subredditId) || 'Nexus',
        }
      })
    } catch {
      results.posts = []
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  })
}
