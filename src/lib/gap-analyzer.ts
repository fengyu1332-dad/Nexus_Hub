import { db } from '@/lib/db'

interface ContentGap {
  type: 'tag_undercovered' | 'inactive_subreddit' | 'low_search_coverage'
  label: string
  detail: string
  severity: 'high' | 'medium' | 'low'
}

interface SuggestedTopic {
  topic: string
  reason: string
  type: 'gap_fill' | 'trending' | 'evergreen'
}

/**
 * Analyze content gaps across three dimensions:
 * 1. Tag undercoverage — high-priority tags with few posts
 * 2. Inactive subreddits — communities with no posts in 30 days
 * 3. (Future) Search demand mismatch
 */
export async function detectContentGaps(): Promise<ContentGap[]> {
  const gaps: ContentGap[] = []

  try {
    // ── 1. Tag undercoverage ───────────────────────
    const tags = (await db.tag.findMany({
      orderBy: { postCount: 'asc' },
      take: 30,
      select: { name: true, postCount: true },
    }).catch(() => [])) as { name: string; postCount: number }[]

    for (const tag of tags) {
      if ((tag as any).postCount < 3) {
        gaps.push({
          type: 'tag_undercovered',
          label: `标签 "${tag.name}" 内容不足`,
          detail: `仅 ${(tag as any).postCount} 篇帖子`,
          severity: (tag as any).postCount === 0 ? 'high' : 'medium',
        })
      }
    }

    // ── 2. Inactive subreddits ─────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const subs = (await db.subreddit.findMany({
      take: 50,
      select: { id: true, name: true, postCount: true },
    }).catch(() => [])) as { id: string; name: string; postCount: number }[]

    for (const sub of subs) {
      if ((sub as any).postCount === 0) continue

      // Check if any posts in the last 30 days
      const recentPosts = await db.post.findMany({
        where: {
          subredditId: sub.id,
          createdAt: { gte: thirtyDaysAgo },
        },
        take: 1,
        select: { id: true },
      }).catch(() => []) as { id: string }[]

      if (recentPosts.length === 0 && (sub as any).postCount > 0) {
        gaps.push({
          type: 'inactive_subreddit',
          label: `社区 "${sub.name}" 无新内容`,
          detail: `30 天内无新帖，共 ${(sub as any).postCount} 篇历史帖子`,
          severity: 'medium',
        })
      }
    }
  } catch (err) {
    console.error('[gap-analyzer] Error detecting gaps:', err)
  }

  return gaps
}

/**
 * Suggest writing topics based on detected gaps.
 */
export async function suggestTopics(limit = 5): Promise<SuggestedTopic[]> {
  const topics: SuggestedTopic[] = []
  const gaps = await detectContentGaps()

  // Generate topic suggestions from high-priority gaps
  const highPriorityGaps = gaps.filter((g) => g.severity === 'high')
  for (const gap of highPriorityGaps.slice(0, limit)) {
    if (gap.type === 'tag_undercovered') {
      const tagName = gap.label.replace(/标签 "(.+)" 内容不足/, '$1')
      topics.push({
        topic: `${tagName} 入门指南`,
        reason: `标签 "${tagName}" 覆盖不足，仅 ${gap.detail.match(/\d+/)?.[0] || '0'} 篇`,
        type: 'gap_fill',
      })
    } else if (gap.type === 'inactive_subreddit') {
      const subName = gap.label.replace(/社区 "(.+)" 无新内容/, '$1')
      topics.push({
        topic: `${subName} 最新动态与趋势`,
        reason: `社区 30 天无新帖，需要激活`,
        type: 'gap_fill',
      })
    }
  }

  // Add evergreen topic suggestions if we don't have enough
  const evergreenTopics = [
    '2026 秋季留学申请时间线',
    'SAT vs ACT 备考策略对比',
    '美国 Top 20 大学录取数据分析',
    '竞赛背景对申请的真正价值',
    '留学文书的五大常见误区',
  ]

  for (const topic of evergreenTopics) {
    if (topics.length >= limit) break
    if (!topics.find((t) => t.topic === topic)) {
      topics.push({ topic, reason: '常青内容，对读者持续有价值', type: 'evergreen' })
    }
  }

  return topics.slice(0, limit)
}
