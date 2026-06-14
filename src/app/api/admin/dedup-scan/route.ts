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
      .substring(0, 1000)
  } catch {
    return typeof content === 'string' ? content.substring(0, 1000) : ''
  }
}

function titleSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim()
  const bNorm = b.toLowerCase().trim()
  if (aNorm === bNorm) return 1

  // Check if one contains the other
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.9

  // Simple word overlap ratio
  const aWords = new Set(aNorm.split(/\s+/))
  const bWords = new Set(bNorm.split(/\s+/))
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)))
  const union = new Set([...aWords, ...bWords])
  return union.size === 0 ? 0 : intersection.size / union.size
}

function contentPrefixMatch(a: string, b: string): number {
  // Compare first N chars
  const len = Math.min(a.length, b.length, 200)
  if (len === 0) return 0
  let matches = 0
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) matches++
  }
  return matches / len
}

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    // Fetch all posts (limit to recent 500 for performance)
    const posts = await db.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
    })

    const duplicates: Array<{
      postA: { id: string; title: string; createdAt: string }
      postB: { id: string; title: string; createdAt: string }
      reason: string
      score: number
    }> = []

    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        const a = posts[i] as any
        const b = posts[j] as any

        // Exact title match
        if (a.title?.toLowerCase().trim() === b.title?.toLowerCase().trim()) {
          duplicates.push({
            postA: { id: a.id, title: a.title, createdAt: a.createdAt },
            postB: { id: b.id, title: b.title, createdAt: b.createdAt },
            reason: '标题完全相同',
            score: 1,
          })
          continue
        }

        // High title similarity
        const titleSim = titleSimilarity(a.title || '', b.title || '')
        if (titleSim >= 0.85) {
          duplicates.push({
            postA: { id: a.id, title: a.title, createdAt: a.createdAt },
            postB: { id: b.id, title: b.title, createdAt: b.createdAt },
            reason: `标题高度相似 (${Math.round(titleSim * 100)}%)`,
            score: titleSim,
          })
          continue
        }

        // Content prefix match (fast approximation)
        const textA = extractText(a.content)
        const textB = extractText(b.content)
        if (textA && textB && textA.length > 100 && textB.length > 100) {
          const prefixSim = contentPrefixMatch(textA, textB)
          if (prefixSim >= 0.9) {
            duplicates.push({
              postA: { id: a.id, title: a.title, createdAt: a.createdAt },
              postB: { id: b.id, title: b.title, createdAt: b.createdAt },
              reason: `正文前缀高度相似 (${Math.round(prefixSim * 100)}%)`,
              score: prefixSim,
            })
          }
        }
      }
    }

    // Sort by score descending
    duplicates.sort((a, b) => b.score - a.score)

    // Batch resolve authors and subreddits
    const allIds = new Set<string>()
    duplicates.forEach((d) => {
      allIds.add(d.postA.id)
      allIds.add(d.postB.id)
    })

    const authorMap = new Map()
    const subMap = new Map()
    if (allIds.size > 0) {
      const fullPosts = await db.post.findMany({
        where: { id: { in: Array.from(allIds).slice(0, 100) } },
        select: { id: true, authorId: true, subredditId: true },
      })
      const authorIds = [...new Set(fullPosts.map((p: any) => p.authorId).filter(Boolean))]
      const subIds = [...new Set(fullPosts.map((p: any) => p.subredditId).filter(Boolean))]
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
    }

    // Enrich results
    const enriched = duplicates.slice(0, 30).map((d) => {
      const enrichPost = (p: typeof d.postA) => {
        const full = posts.find((fp: any) => fp.id === p.id)
        const authorId = (full as any)?.authorId
        const subId = (full as any)?.subredditId
        return {
          ...p,
          author: authorMap.get(authorId) || { username: 'Unknown', isAI: false, aiRole: null },
          subreddit: subMap.get(subId) || { name: 'Nexus', displayName: null },
        }
      }
      return {
        ...d,
        postA: enrichPost(d.postA),
        postB: enrichPost(d.postB),
      }
    })

    return new Response(
      JSON.stringify({
        totalScanned: posts.length,
        duplicatesFound: duplicates.length,
        results: enriched,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Scan failed: ' + (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
