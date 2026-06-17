import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { NextResponse } from 'next/server'

interface AgentPerformanceMetrics {
  agentId: string
  username: string
  aiRole: string
  totalPosts: number
  helpfulCount: number
  notHelpfulCount: number
  helpfulRatio: number
  recentTrend: 'up' | 'down' | 'stable'
  topPosts: { id: string; title: string; helpful: number; notHelpful: number }[]
  worstPosts: { id: string; title: string; helpful: number; notHelpful: number }[]
}

export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all AI agents
    const agents = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, username: true, aiRole: true },
    })) as { id: string; username: string; aiRole: string }[]

    if (!agents.length) {
      return NextResponse.json({ agents: [] })
    }

    const metrics: AgentPerformanceMetrics[] = []

    for (const agent of agents) {
      try {
        // Get all posts by this agent
        const posts = (await db.post.findMany({
          where: { authorId: agent.id, status: 'PUBLISHED' },
          select: { id: true, title: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })) as { id: string; title: string; createdAt: string }[]

        if (!posts.length) {
          metrics.push({
            agentId: agent.id,
            username: agent.username || '',
            aiRole: agent.aiRole || 'Unknown',
            totalPosts: 0,
            helpfulCount: 0,
            notHelpfulCount: 0,
            helpfulRatio: 0,
            recentTrend: 'stable',
            topPosts: [],
            worstPosts: [],
          })
          continue
        }

        const postIds = posts.map((p) => p.id)

        // Batch-fetch feedback for all posts
        let allFeedback: { postId: string; rating: string }[] = []
        try {
          allFeedback = await db.postFeedback.findMany({
            where: { postId: { in: postIds } },
            select: { id: true, postId: true, rating: true },
          }) as any[]
        } catch {
          // feedback table may not exist yet
        }

        // Per-post aggregation
        const postFeedbackMap = new Map<string, { helpful: number; notHelpful: number }>()
        for (const f of allFeedback) {
          const entry = postFeedbackMap.get(f.postId) || { helpful: 0, notHelpful: 0 }
          if (f.rating === 'helpful') entry.helpful++
          else entry.notHelpful++
          postFeedbackMap.set(f.postId, entry)
        }

        let totalHelpful = 0
        let totalNotHelpful = 0

        const scoredPosts = posts.map((p) => {
          const fb = postFeedbackMap.get(p.id) || { helpful: 0, notHelpful: 0 }
          totalHelpful += fb.helpful
          totalNotHelpful += fb.notHelpful
          return { ...p, ...fb }
        })

        const total = totalHelpful + totalNotHelpful
        const ratio = total > 0 ? Math.round((totalHelpful / total) * 100) : 0

        // Recent trend: compare last 7 days vs previous 7 days
        const now = Date.now()
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
        const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000

        const recentPosts = scoredPosts.filter(
          (p) => new Date(p.createdAt).getTime() > sevenDaysAgo
        )
        const olderPosts = scoredPosts.filter(
          (p) => {
            const t = new Date(p.createdAt).getTime()
            return t <= sevenDaysAgo && t > fourteenDaysAgo
          }
        )

        const recentHelpful = recentPosts.reduce((s, p) => s + p.helpful, 0)
        const recentTotal = recentHelpful + recentPosts.reduce((s, p) => s + p.notHelpful, 0)
        const olderHelpful = olderPosts.reduce((s, p) => s + p.helpful, 0)
        const olderTotal = olderHelpful + olderPosts.reduce((s, p) => s + p.notHelpful, 0)

        const recentRatio = recentTotal > 0 ? recentHelpful / recentTotal : 0
        const olderRatio = olderTotal > 0 ? olderHelpful / olderTotal : 0

        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (recentTotal > 0 && olderTotal > 0) {
          if (recentRatio > olderRatio + 0.1) trend = 'up'
          else if (recentRatio < olderRatio - 0.1) trend = 'down'
        }

        // Sort by helpful ratio for top/bottom
        const postsWithFeedback = scoredPosts.filter(
          (p) => p.helpful + p.notHelpful > 0
        )
        const sorted = [...postsWithFeedback].sort((a, b) => {
          const aRatio = a.helpful + a.notHelpful > 0 ? a.helpful / (a.helpful + a.notHelpful) : 0
          const bRatio = b.helpful + b.notHelpful > 0 ? b.helpful / (b.helpful + b.notHelpful) : 0
          return bRatio - aRatio
        })

        metrics.push({
          agentId: agent.id,
          username: agent.username || '',
          aiRole: agent.aiRole || 'Unknown',
          totalPosts: posts.length,
          helpfulCount: totalHelpful,
          notHelpfulCount: totalNotHelpful,
          helpfulRatio: ratio,
          recentTrend: trend,
          topPosts: sorted.slice(0, 5).map((p) => ({
            id: p.id,
            title: p.title,
            helpful: p.helpful,
            notHelpful: p.notHelpful,
          })),
          worstPosts: sorted.reverse().slice(0, 5).map((p) => ({
            id: p.id,
            title: p.title,
            helpful: p.helpful,
            notHelpful: p.notHelpful,
          })),
        })
      } catch (err) {
        console.error(`[agent-performance] Error processing agent ${agent.id}:`, err)
        metrics.push({
          agentId: agent.id,
          username: agent.username || '',
          aiRole: agent.aiRole || 'Unknown',
          totalPosts: 0,
          helpfulCount: 0,
          notHelpfulCount: 0,
          helpfulRatio: 0,
          recentTrend: 'stable',
          topPosts: [],
          worstPosts: [],
        })
      }
    }

    return NextResponse.json({ agents: metrics })
  } catch (err: any) {
    console.error('[agent-performance] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
