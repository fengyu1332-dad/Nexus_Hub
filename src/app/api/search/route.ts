import { db } from '@/lib/db'
import { getEmbedding, cosineSimilarity } from '@/lib/embedding'
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

function tokenizeForTsquery(q: string): string {
  return q
    .replace(/[^\w一-鿿]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t + ':*')
    .join(' & ') || q
}

function matchQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')
  const type = url.searchParams.get('type') || 'all'
  const tagFilter = url.searchParams.get('tags') || ''

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

  // Search communities — match both name (slug) and displayName (Chinese)
  if (type === 'communities' || type === 'all') {
    try {
      const allCommunities = await db.subreddit.findMany({
        include: { _count: true },
        select: { id: true, name: true, displayName: true, _count: true },
        take: 50,
      })

      results.communities = (allCommunities || [])
        .filter((c: any) => {
          const name = (c.name || '').toLowerCase()
          const display = (c.displayName || '').toLowerCase()
          const query = q.toLowerCase()
          return name.includes(query) || display.includes(query)
        })
        .slice(0, 5)
    } catch {
      results.communities = []
    }
  }

  // Search posts — FTS first, in-memory fallback
  if (type === 'posts' || type === 'all') {
    try {
      let ftsResults: any[] | null = null

      // Attempt FTS via raw SQL (works with direct PostgreSQL connection)
      try {
        const tsquery = tokenizeForTsquery(q)
        const raw = await db.$queryRawUnsafe(
          `SELECT p."id", p."title", p."content", p."createdAt", p."authorId", p."subredditId", ` +
          `ts_rank(p."searchVector", to_tsquery('simple', $1)) AS "_rank" ` +
          `FROM "Post" p ` +
          `WHERE p."searchVector" @@ to_tsquery('simple', $1) ` +
          `AND p."status" = 'PUBLISHED' ` +
          `ORDER BY "_rank" DESC, p."createdAt" DESC ` +
          `LIMIT 20`,
          tsquery
        ) as any[]
        if (raw && raw.length > 0) {
          ftsResults = raw
        }
      } catch {
        // FTS not available — fall through to in-memory
      }

      let scored: any[]
      if (ftsResults) {
        scored = ftsResults
      } else {
        // In-memory fallback: fetch recent published posts, score and filter
        const allPosts = await db.post.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            authorId: true,
            subredditId: true,
            status: true,
          },
        })

        const published = (allPosts || []).filter((p: any) => p.status !== 'DRAFT')

        scored = published
          .map((p: any) => {
            const title = p.title || ''
            const body = extractTextFromContent(p.content || '')
            let score = 0
            if (matchQuery(title, q)) score += 10
            if (matchQuery(body, q)) score += 1
            return { ...p, _score: score }
          })
          .filter((p: any) => p._score > 0)
          .sort((a: any, b: any) => b._score - a._score)
          .slice(0, 8)
      }

      // Resolve authors and subreddits
      const authorIds = [...new Set(scored.map((p: any) => p.authorId).filter(Boolean))]
      const subIds = [...new Set(scored.map((p: any) => p.subredditId).filter(Boolean))]
      const authorMap = new Map()
      const subMap = new Map()
      for (const id of authorIds) {
        const u = await db.user.findFirst({ where: { id }, select: { username: true, isAI: true, aiRole: true } })
        if (u) authorMap.set(id, u)
      }
      for (const id of subIds) {
        const s = await db.subreddit.findFirst({ where: { id }, select: { name: true, displayName: true } })
        if (s) subMap.set(id, { name: (s as any).name, displayName: (s as any).displayName })
      }

      results.posts = scored.map((p: any) => {
        const excerpt = extractTextFromContent(p.content).substring(0, 200)
        const sub = subMap.get(p.subredditId)
        return {
          id: p.id,
          title: p.title,
          excerpt,
          createdAt: p.createdAt,
          author: authorMap.get(p.authorId) || { username: 'Unknown' },
          subredditName: sub?.name || 'Nexus',
          subredditDisplayName: sub?.displayName || sub?.name || 'Nexus',
        }
      })
    } catch {
      results.posts = []
    }

    // Semantic search fallback: when keyword results are sparse (< 3),
    // try to boost recall with embedding-based similarity
    if (type === 'posts' || type === 'all') {
      try {
        const keywordCount = results.posts?.length || 0
        if (keywordCount < 3 && process.env.EMBEDDING_API_KEY) {
          const queryEmbedding = await getEmbedding(q)
          if (queryEmbedding.length > 0) {
            // Get posts with embeddings
            const embeddedPosts = await db.post.findMany({
              where: { status: 'PUBLISHED' },
              select: { id: true, title: true, content: true, embedding: true, createdAt: true, authorId: true, subredditId: true },
              take: 200,
            }) as any[]

            const validEmbedded = (embeddedPosts || []).filter(
              (p: any) => p.embedding && Array.isArray(p.embedding) && p.embedding.length > 0
            )

            if (validEmbedded.length > 0) {
              const semanticResults = validEmbedded
                .map((p: any) => ({
                  ...p,
                  _similarity: cosineSimilarity(queryEmbedding, p.embedding as number[]),
                }))
                .filter((p: any) => p._similarity > 0.5)
                .sort((a: any, b: any) => b._similarity - a._similarity)
                .slice(0, 10)

              // Merge with keyword results, deduplicate by post id
              const existingIds = new Set((results.posts || []).map((p: any) => p.id))
              const merged = [...(results.posts || [])]

              for (const sp of semanticResults) {
                if (!existingIds.has(sp.id)) {
                  const excerpt = extractTextFromContent(sp.content).substring(0, 200)
                  merged.push({
                    id: sp.id,
                    title: sp.title,
                    excerpt,
                    createdAt: sp.createdAt,
                    author: { username: 'AI' },
                    subredditName: 'Nexus',
                    subredditDisplayName: 'Nexus',
                    _semantic: true,
                  })
                }
              }

              // Resolve authors for semantic results
              const semIds = merged.filter((p: any) => p._semantic).map((p: any) => p.id)
              if (semIds.length > 0) {
                const authorIds = [...new Set(semanticResults.map((p: any) => p.authorId).filter(Boolean))]
                const subIds = [...new Set(semanticResults.map((p: any) => p.subredditId).filter(Boolean))]
                const authorMap = new Map()
                const subMap = new Map()
                for (const id of authorIds) {
                  const u = await db.user.findFirst({ where: { id }, select: { username: true, isAI: true, aiRole: true } })
                  if (u) authorMap.set(id, u)
                }
                for (const id of subIds) {
                  const s = await db.subreddit.findFirst({ where: { id }, select: { name: true, displayName: true } })
                  if (s) subMap.set(id, { name: (s as any).name, displayName: (s as any).displayName })
                }
                for (const p of merged) {
                  if (p._semantic) {
                    const orig = semanticResults.find((sp: any) => sp.id === p.id)
                    if (orig) {
                      p.author = authorMap.get(orig.authorId) || { username: 'AI' }
                      const sub = subMap.get(orig.subredditId)
                      p.subredditName = sub?.name || 'Nexus'
                      p.subredditDisplayName = sub?.displayName || p.subredditName
                    }
                  }
                }
              }

              results.posts = merged
            }
          }
        }
      } catch {
        // Semantic search enhancement is best-effort
      }
    }

    // Tag filter: restrict results to posts with specific tags
    if (tagFilter && results.posts?.length > 0) {
      try {
        const tagSlugs = tagFilter.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        if (tagSlugs.length > 0) {
          const matchedTags = await db.tag.findMany({
            where: { slug: { in: tagSlugs } },
            select: { id: true },
          }) as any[]
          const matchedTagIds = matchedTags.map((t: any) => t.id)

          if (matchedTagIds.length > 0) {
            const postIds = results.posts.map((p: any) => p.id)
            const postTags = await db.postTag.findMany({
              where: { postId: { in: postIds }, tagId: { in: matchedTagIds } },
              select: { postId: true },
            }) as any[]
            const taggedPostIds = new Set<string>(postTags.map((pt: any) => pt.postId))
            results.posts = results.posts.filter((p: any) => taggedPostIds.has(p.id))
          } else {
            results.posts = []
          }
        }
      } catch {
        // Tag filter is best-effort
      }
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  })
}
