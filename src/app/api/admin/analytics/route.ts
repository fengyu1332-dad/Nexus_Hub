import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const metric = url.searchParams.get('metric') || 'overview'
  const days = parseInt(url.searchParams.get('days') || '30')
  const limit = parseInt(url.searchParams.get('limit') || '10')

  try {
    switch (metric) {
      case 'overview':
        return NextResponse.json(await getOverview())
      case 'post_volume':
        return NextResponse.json(await getPostVolume(days))
      case 'top_posts':
        return NextResponse.json(await getTopPosts(days, limit))
      case 'tag_distribution':
        return NextResponse.json(await getTagDistribution())
      case 'agent_performance':
        return NextResponse.json(await getAgentPerformance())
      case 'pipeline_aggregate':
        return NextResponse.json(await getPipelineAggregate())
      default:
        return NextResponse.json({ error: 'Unknown metric' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[analytics] Error:', err.message || err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function getOverview() {
  const [totalPosts, totalComments, totalUsers, totalCommunities, aiUsers, recentPosts] = await Promise.all([
    db.post.count().catch(() => 0),
    db.comment.count().catch(() => 0),
    db.user.count().catch(() => 0),
    db.subreddit.count().catch(() => 0),
    (db.user.findMany({ where: { isAI: true }, select: { id: true } }) as Promise<{ id: string }[]>).catch(() => []),
    (db.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, createdAt: true, voteCount: true },
    }) as Promise<{ id: string; createdAt: string; voteCount: number }[]>).catch(() => []),
  ])

  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000

  const thisWeekPosts = recentPosts.filter(
    (p: any) => new Date(p.createdAt).getTime() > weekAgo
  )
  const thisWeekVotes = thisWeekPosts.reduce((s: number, p: any) => s + (p.voteCount || 0), 0)

  // Comments this week (approximate via post creation date)
  const thisWeekPostIds = thisWeekPosts.map((p: any) => p.id)

  let thisWeekComments = 0
  if (thisWeekPostIds.length > 0) {
    thisWeekComments = await db.comment
      .count({ where: { postId: { in: thisWeekPostIds } } })
      .catch(() => 0)
  }

  const aiUserIds = aiUsers.map((u: any) => u.id)
  let activeAgents = 0
  if (aiUserIds.length > 0) {
    const aiPostsThisWeek = await db.post
      .findMany({
        where: { authorId: { in: aiUserIds } },
        select: { authorId: true, createdAt: true },
        take: 500,
      })
      .catch(() => []) as { authorId: string; createdAt: string }[]

    const activeSet = new Set<string>()
    for (const p of aiPostsThisWeek) {
      if (new Date(p.createdAt).getTime() > weekAgo) {
        activeSet.add(p.authorId)
      }
    }
    activeAgents = activeSet.size
  }

  return {
    totalPosts,
    totalComments,
    totalUsers,
    totalCommunities,
    thisWeekPosts: thisWeekPosts.length,
    thisWeekComments,
    thisWeekVotes,
    activeAgents,
    totalAgents: aiUsers.length,
  }
}

async function getPostVolume(days: number) {
  const posts = (await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1000,
    select: { id: true, createdAt: true },
  }).catch(() => [])) as { id: string; createdAt: string }[]

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const dailyMap = new Map<string, number>()

  for (const p of posts) {
    const d = new Date(p.createdAt)
    if (d.getTime() < cutoff) continue
    const key = d.toISOString().slice(0, 10) // YYYY-MM-DD
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
  }

  // Fill in missing days
  const result: { date: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, count: dailyMap.get(key) || 0 })
  }

  return result
}

async function getTopPosts(days: number, limit: number) {
  const posts = (await db.post.findMany({
    orderBy: { voteCount: 'desc' },
    take: 200,
    select: { id: true, title: true, voteCount: true, createdAt: true, authorId: true, subredditId: true },
  }).catch(() => [])) as any[]

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

  // Get comment counts
  const postIds = posts.map((p: any) => p.id)
  const commentCountMap = new Map<string, number>()
  if (postIds.length > 0) {
    for (const pid of postIds) {
      const count = await db.comment.count({ where: { postId: pid } }).catch(() => 0)
      commentCountMap.set(pid, count)
    }
  }

  // Resolve author and subreddit names
  const authorIds = Array.from(new Set(posts.map((p: any) => p.authorId)))
  const subIds = Array.from(new Set(posts.map((p: any) => p.subredditId)))
  const authorMap = new Map<string, string>()
  const subMap = new Map<string, string>()

  for (const aid of authorIds) {
    const u = await db.user.findFirst({ where: { id: aid }, select: { username: true, aiRole: true } }).catch(() => null)
    authorMap.set(aid, (u as any)?.aiRole || (u as any)?.username || 'User')
  }
  for (const sid of subIds) {
    const s = await db.subreddit.findFirst({ where: { id: sid }, select: { name: true } }).catch(() => null)
    subMap.set(sid, (s as any)?.name || 'unknown')
  }

  return posts
    .filter((p: any) => new Date(p.createdAt).getTime() > cutoff)
    .slice(0, limit)
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      authorRole: authorMap.get(p.authorId) || 'Unknown',
      subredditName: subMap.get(p.subredditId) || 'unknown',
      voteCount: p.voteCount || 0,
      commentCount: commentCountMap.get(p.id) || 0,
      createdAt: p.createdAt,
    }))
}

async function getTagDistribution() {
  try {
    const tags = (await db.tag.findMany({
      orderBy: { postCount: 'desc' },
      take: 50,
    }).catch(() => [])) as { name: string; postCount: number }[]

    return tags
      .filter((t: any) => t.postCount > 0)
      .map((t: any) => ({ name: t.name, count: t.postCount }))
  } catch {
    return []
  }
}

async function getAgentPerformance() {
  try {
    const agents = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, username: true, aiRole: true },
    }).catch(() => [])) as { id: string; username: string; aiRole: string }[]

    if (!agents.length) return { agents: [] }

    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000

    const result = await Promise.all(
      agents.map(async (agent) => {
        const posts = (await db.post.findMany({
          where: { authorId: agent.id },
          select: { id: true, voteCount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }).catch(() => [])) as { id: string; voteCount: number; createdAt: string }[]

        if (!posts.length) {
          return {
            agentId: agent.id,
            username: agent.username || '',
            aiRole: agent.aiRole || 'Unknown',
            totalPosts: 0,
            totalVotes: 0,
            recentPosts: 0,
            avgVotesPerPost: 0,
          }
        }

        const postIds = posts.map((p) => p.id)
        let helpfulCount = 0
        let notHelpfulCount = 0

        try {
          const feedback = (await db.postFeedback.findMany({
            where: { postId: { in: postIds } },
            select: { rating: true },
          }).catch(() => [])) as { rating: string }[]
          helpfulCount = feedback.filter((f: any) => f.rating === 'helpful').length
          notHelpfulCount = feedback.filter((f: any) => f.rating === 'not_helpful').length
        } catch { /* table may not exist */ }

        const totalFeedback = helpfulCount + notHelpfulCount
        const helpfulRatio = totalFeedback > 0 ? Math.round((helpfulCount / totalFeedback) * 100) : 0
        const recentPosts = posts.filter((p) => new Date(p.createdAt).getTime() > weekAgo).length

        return {
          agentId: agent.id,
          username: agent.username || '',
          aiRole: agent.aiRole || 'Unknown',
          totalPosts: posts.length,
          totalVotes: posts.reduce((s, p) => s + (p.voteCount || 0), 0),
          recentPosts,
          helpfulCount,
          notHelpfulCount,
          helpfulRatio,
          avgVotesPerPost: posts.length > 0
            ? Math.round((posts.reduce((s, p) => s + (p.voteCount || 0), 0) / posts.length) * 10) / 10
            : 0,
        }
      })
    )

    return { agents: result }
  } catch (err) {
    console.error('[analytics] agent_performance error:', err)
    return { agents: [] }
  }
}

async function getPipelineAggregate() {
  try {
    const executions = (await db.pipelineExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => [])) as { pipelineType: string; status: string }[]

    const typeMap = new Map<string, { total: number; success: number; failed: number; dead: number }>()

    for (const e of executions) {
      const entry = typeMap.get(e.pipelineType) || { total: 0, success: 0, failed: 0, dead: 0 }
      entry.total++
      if (e.status === 'success') entry.success++
      else if (e.status === 'failed') entry.failed++
      else if (e.status === 'dead_letter') entry.dead++
      typeMap.set(e.pipelineType, entry)
    }

    const byType = Array.from(typeMap.entries()).map(([type, counts]) => ({
      pipelineType: type,
      ...counts,
      successRate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
    }))

    const total = executions.length
    const totalSuccess = executions.filter((e: any) => e.status === 'success').length

    return {
      total,
      totalSuccess,
      overallSuccessRate: total > 0 ? Math.round((totalSuccess / total) * 100) : 0,
      byType,
    }
  } catch {
    return { total: 0, totalSuccess: 0, overallSuccessRate: 0, byType: [] }
  }
}
