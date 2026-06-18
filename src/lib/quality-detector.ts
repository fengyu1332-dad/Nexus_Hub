import { db } from '@/lib/db'

interface LowQualityPost {
  id: string
  title: string
  authorRole: string
  subredditName: string
  voteCount: number
  commentCount: number
  helpfulRatio: number
  feedbackCount: number
  createdAt: string
}

/**
 * Detect low-quality AI posts from the past N days.
 *
 * Criteria (configurable via PipelineConfig `quality_detection_rules`):
 * - Default: votes <= 0 AND (age > 3 days OR comments == 0) AND helpfulRatio < 30%
 */
export async function detectLowQualityPosts(days = 7): Promise<LowQualityPost[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Get AI user IDs
    const aiUsers = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, aiRole: true },
    }).catch(() => [])) as { id: string; aiRole: string | null }[]

    const aiUserIds = aiUsers.map((u) => u.id)
    if (!aiUserIds.length) return []

    const authorMap = new Map(aiUsers.map((u) => [u.id, u.aiRole || 'AI']))

    // Get AI posts from recent days
    const posts = (await db.post.findMany({
      where: {
        authorId: { in: aiUserIds },
        createdAt: { gte: cutoff },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, authorId: true, subredditId: true, voteCount: true, createdAt: true },
    }).catch(() => [])) as any[]

    if (!posts.length) return []

    // Get comment counts
    const postIds = posts.map((p: any) => p.id)
    const commentCountMap = new Map<string, number>()
    for (const pid of postIds) {
      const count = await db.comment.count({ where: { postId: pid } }).catch(() => 0)
      commentCountMap.set(pid, count)
    }

    // Get feedback ratios
    let feedbackMap = new Map<string, { helpful: number; notHelpful: number }>()
    try {
      const allFeedback = await db.postFeedback.findMany({
        where: { postId: { in: postIds } },
        select: { postId: true, rating: true },
      }).catch(() => []) as { postId: string; rating: string }[]

      for (const fb of allFeedback) {
        const entry = feedbackMap.get(fb.postId) || { helpful: 0, notHelpful: 0 }
        if (fb.rating === 'helpful') entry.helpful++
        else entry.notHelpful++
        feedbackMap.set(fb.postId, entry)
      }
    } catch { /* table may not exist */ }

    // Resolve subreddit names
    const subIds = Array.from(new Set(posts.map((p: any) => p.subredditId)))
    const subMap = new Map<string, string>()
    for (const sid of subIds) {
      const s = await db.subreddit.findFirst({ where: { id: sid }, select: { name: true } }).catch(() => null)
      subMap.set(sid, (s as any)?.name || 'unknown')
    }

    // Load thresholds
    let minVotes = 0
    let minAgeDays = 3
    let maxHelpfulRatio = 30
    try {
      const cfg = await db.pipelineConfig.findFirst({
        where: { key: 'quality_detection_rules' },
      }).catch(() => null)
      if (cfg && (cfg as any).value) {
        const rules = JSON.parse((cfg as any).value)
        if (rules?.min_votes !== undefined) minVotes = rules.min_votes
        if (rules?.min_age_days !== undefined) minAgeDays = rules.min_age_days
        if (rules?.max_helpful_ratio !== undefined) maxHelpfulRatio = rules.max_helpful_ratio
      }
    } catch { /* use defaults */ }

    const now = Date.now()
    const ageCutoff = now - minAgeDays * 24 * 60 * 60 * 1000

    const result: LowQualityPost[] = []
    for (const p of posts) {
      const votes = p.voteCount || 0
      const comments = commentCountMap.get(p.id) || 0
      const fb = feedbackMap.get(p.id) || { helpful: 0, notHelpful: 0 }
      const fbTotal = fb.helpful + fb.notHelpful
      const ratio = fbTotal > 0 ? Math.round((fb.helpful / fbTotal) * 100) : 0
      const postAge = new Date(p.createdAt).getTime()

      const isLowQuality =
        votes <= minVotes &&
        (postAge < ageCutoff || comments === 0) &&
        (fbTotal === 0 || ratio < maxHelpfulRatio)

      if (isLowQuality) {
        result.push({
          id: p.id,
          title: p.title,
          authorRole: authorMap.get(p.authorId) || 'AI',
          subredditName: subMap.get(p.subredditId) || 'unknown',
          voteCount: votes,
          commentCount: comments,
          helpfulRatio: ratio,
          feedbackCount: fbTotal,
          createdAt: p.createdAt,
        })
      }
    }

    return result
  } catch (err) {
    console.error('[quality-detector] Error:', err)
    return []
  }
}

/**
 * Auto-rewrite a low-quality post using DeepSeek.
 * Creates a NEW post (does not modify original).
 * The original post can be marked as rewritten via a separate admin action.
 */
export async function autoRewritePost(
  postId: string,
  originalTitle: string,
  originalContent?: string
): Promise<{ rewrittenPostId: string; rewrittenTitle: string } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) return null

  try {
    // Get the original post content if not provided
    if (!originalContent) {
      const post = await db.post.findFirst({
        where: { id: postId },
        select: { content: true, authorId: true, subredditId: true },
      }).catch(() => null)

      if (!post) return null

      try {
        const parsed = typeof (post as any).content === 'string'
          ? JSON.parse((post as any).content)
          : (post as any).content
        originalContent = (parsed?.blocks || [])
          .map((b: any) => b.data?.text || '')
          .join(' ')
          .replace(/<[^>]+>/g, '')
          .substring(0, 3000)
      } catch {
        originalContent = String((post as any).content || '').substring(0, 3000)
      }
    }

    // Call DeepSeek for rewrite
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: `Rewrite the following academic article about study-abroad / international education. Make it more engaging, deeper analysis, better structured. Keep the topic but improve quality significantly.\n\nOriginal title: ${originalTitle}\n\nOriginal content: ${originalContent}\n\nRespond with JSON: { "title": "rewritten title", "content": {"blocks":[{"type":"paragraph","data":{"text":"rewritten content paragraph..."}}]} }`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!res.ok) return null

    const json = await res.json()
    const reply = json.choices?.[0]?.message?.content || ''

    let title = `${originalTitle} (Rewritten)`
    let content: any = { blocks: [{ type: 'paragraph', data: { text: reply } }] }

    try {
      const match = reply.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        title = parsed.title || title
        content = parsed.content || content
      }
    } catch { /* use raw */ }

    // Find Newton to author the rewrite
    const newtonUser = await db.user.findFirst({
      where: { isAI: true, aiRole: 'Newton' },
      select: { id: true },
    }).catch(() => null)

    const anyAiUser = (!newtonUser
      ? await db.user.findFirst({ where: { isAI: true }, select: { id: true } }).catch(() => null)
      : null)

    const authorId = (newtonUser as any)?.id || (anyAiUser as any)?.id
    if (!authorId) return null

    // Get subreddit
    const originalPost = await db.post.findFirst({
      where: { id: postId },
      select: { subredditId: true },
    }).catch(() => null)

    const subredditId = (originalPost as any)?.subredditId
    if (!subredditId) return null

    // Create the new post
    const newPost = await db.post.create({
      data: {
        title,
        content: JSON.stringify(content),
        authorId,
        subredditId,
        status: 'PUBLISHED',
      },
    }).catch(() => null)

    if (!newPost) return null

    return {
      rewrittenPostId: (newPost as any).id,
      rewrittenTitle: title,
    }
  } catch (err) {
    console.error('[quality-detector] Rewrite error:', err)
    return null
  }
}
