import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { n8n } from '@/lib/n8n'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/i18n'
import type { DbUser } from '@/lib/types'
import { AIDashboardClient } from '@/components/admin/AIDashboardClient'
import { EmbeddingStatusCard } from '@/components/admin/EmbeddingStatusCard'

export const dynamic = 'force-dynamic'

export default async function AIDashboardPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const d = dict.admin

  // ── 1. n8n workflows ────────────────────────────────────────
  const workflows = await n8n.listWorkflows()

  const workflowDetails = await Promise.all(
    workflows.map(async (wf) => {
      const executions = await n8n.listExecutions(wf.id, 5)
      const successCount = executions.filter((e: any) => e.status === 'success').length
      const errors = executions.filter((e: any) => e.status === 'error')
      return {
        ...wf,
        executions,
        successCount,
        errorCount: errors.length,
        lastError: errors[0]?.stoppedAt
          ? { at: errors[0].stoppedAt, status: 'error' }
          : null,
      }
    })
  )

  // ── 2. AI agent engagement stats ────────────────────────────
  let aiStats: {
    role: string
    postCount: number
    totalVotes: number
    totalComments: number
  }[] = []

  try {
    const aiUsers = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, aiRole: true },
    })) as Pick<DbUser, 'id' | 'aiRole'>[]

    aiStats = await Promise.all(
      aiUsers.map(async (u) => {
        const posts = (await db.post.findMany({
          where: { authorId: u.id },
          select: { id: true, voteCount: true },
        })) as { id: string; voteCount: number }[]

        const postIds = posts.map((p) => p.id)
        const totalVotes = posts.reduce((sum, p) => sum + (p.voteCount || 0), 0)
        let totalComments = 0
        if (postIds.length > 0) {
          totalComments = await db.comment.count({
            where: { postId: { in: postIds } },
          })
        }

        return {
          role: u.aiRole || 'Unknown',
          postCount: posts.length,
          totalVotes,
          totalComments,
        }
      })
    )
  } catch { /* stats may not be available */ }

  // ── 3. Top hot AI posts ──────────────────────────────────────
  let topPosts: {
    id: string
    title: string
    authorRole: string
    subredditName: string
    voteCount: number
    commentCount: number
    createdAt: string
  }[] = []

  try {
    const aiUserIds = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true },
    })) as { id: string }[]
    const aiIds = aiUserIds.map((u) => u.id)

    if (aiIds.length > 0) {
      const hotPosts = (await db.post.findMany({
        where: { authorId: { in: aiIds } },
        orderBy: { voteCount: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          voteCount: true,
          createdAt: true,
          authorId: true,
          subredditId: true,
        },
      })) as any[]

      const authorMap = new Map<string, string>()
      const subMap = new Map<string, string>()

      for (const p of hotPosts) {
        if (!authorMap.has(p.authorId)) {
          const u = await db.user.findFirst({
            where: { id: p.authorId },
            select: { aiRole: true },
          })
          authorMap.set(p.authorId, (u as any)?.aiRole || 'AI')
        }
        if (!subMap.has(p.subredditId)) {
          const s = await db.subreddit.findFirst({
            where: { id: p.subredditId },
            select: { name: true },
          })
          subMap.set(p.subredditId, (s as any)?.name || 'Nexus')
        }
      }

      const commentCounts = new Map<string, number>()
      const postIds = hotPosts.map((p: any) => p.id)
      for (const pid of postIds) {
        const count = await db.comment.count({ where: { postId: pid } })
        commentCounts.set(pid, count)
      }

      topPosts = hotPosts.map((p: any) => ({
        id: p.id,
        title: p.title,
        authorRole: authorMap.get(p.authorId) || 'AI',
        subredditName: subMap.get(p.subredditId) || 'Nexus',
        voteCount: p.voteCount || 0,
        commentCount: commentCounts.get(p.id) || 0,
        createdAt: p.createdAt?.toISOString(),
      }))
    }
  } catch { /* non-critical */ }

  // ── 4. Content distribution by subreddit ─────────────────────
  let contentDistribution: { name: string; count: number }[] = []
  try {
    const aiUserIds = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true },
    })) as { id: string }[]
    const aiIds = aiUserIds.map((u) => u.id)

    if (aiIds.length > 0) {
      const posts = (await db.post.findMany({
        where: { authorId: { in: aiIds } },
        select: { subredditId: true },
      })) as { subredditId: string }[]

      const subCounts = new Map<string, number>()
      for (const p of posts) {
        subCounts.set(p.subredditId, (subCounts.get(p.subredditId) || 0) + 1)
      }

      const subNames = new Map<string, string>()
      for (const sid of Array.from(subCounts.keys())) {
        const s = await db.subreddit.findFirst({
          where: { id: sid },
          select: { name: true, displayName: true },
        })
        subNames.set(sid, (s as any)?.displayName || (s as any)?.name || sid)
      }

      contentDistribution = Array.from(subCounts.entries())
        .map(([id, count]) => ({ name: subNames.get(id) || id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)
    }
  } catch { /* non-critical */ }

  // ── 5. Intel source health ───────────────────────────────────
  let intelHealth: {
    total: number
    active: number
    failing: number
    totalArticles: number
    totalCrawls: number
    lastCrawlAt: string | null
  } = { total: 0, active: 0, failing: 0, totalArticles: 0, totalCrawls: 0, lastCrawlAt: null }

  try {
    const allSources = (await db.intelSource.findMany()) as any[]
    intelHealth.total = allSources.length
    intelHealth.active = allSources.filter((s: any) => s.isActive).length
    intelHealth.failing = allSources.filter(
      (s: any) => s.consecutiveFailures >= (s.maxFailures || 5)
    ).length
    intelHealth.totalArticles = allSources.reduce((sum: number, s: any) => sum + (s.articleCount || 0), 0)
    intelHealth.totalCrawls = allSources.reduce((sum: number, s: any) => sum + (s.crawlCount || 0), 0)
    const lastCrawl = allSources
      .filter((s: any) => s.lastCrawlAt)
      .sort((a: any, b: any) => new Date(b.lastCrawlAt).getTime() - new Date(a.lastCrawlAt).getTime())[0]
    intelHealth.lastCrawlAt = lastCrawl?.lastCrawlAt || null
  } catch { /* non-critical */ }

  // ── 6. Pipeline config ───────────────────────────────────────
  let pipelineConfig: Record<string, string> = {}
  try {
    const configs = (await db.pipelineConfig.findMany()) as { key: string; value: string }[]
    for (const cfg of configs) {
      pipelineConfig[cfg.key] = cfg.value
    }
  } catch { /* config table may not exist yet */ }

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{d.aiDashboard}</h1>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
        <EmbeddingStatusCard labels={{
          embeddingStatus: d.embeddingStatus,
          embeddingCoverage: d.embeddingCoverage,
          postsWithEmbeddings: d.postsWithEmbeddings,
          pendingEmbeddingJobs: d.pendingEmbeddingJobs,
          failedEmbeddingJobs: d.failedEmbeddingJobs,
          backfillEmbeddings: d.backfillEmbeddings,
          noEmbeddingKey: d.noEmbeddingKey,
        }} />
      </div>
      <AIDashboardClient
        initialWorkflows={JSON.parse(JSON.stringify(workflowDetails))}
        aiStats={JSON.parse(JSON.stringify(aiStats))}
        topPosts={JSON.parse(JSON.stringify(topPosts))}
        contentDistribution={JSON.parse(JSON.stringify(contentDistribution))}
        intelHealth={JSON.parse(JSON.stringify(intelHealth))}
        pipelineConfig={pipelineConfig}
        labels={{
          aiDashboard: d.aiDashboard,
          workflowActive: d.workflowActive,
          workflowInactive: d.workflowInactive,
          executeNow: d.executeNow,
          lastExecution: d.lastExecution,
          successRate: d.successRate,
          activate: d.activate,
          deactivate: d.deactivate,
          pipelineConfig: d.pipelineConfig,
          globalCrawlInterval: d.globalCrawlInterval,
          minutes: d.minutes,
          nightQuietHours: d.nightQuietHours,
          enabled: d.enabled,
          disabled: d.disabled,
          save: d.save,
          n8n: d.n8n,
          articles: d.articles,
          executions: d.executions,
          noExecutions: d.noExecutions,
          healthy: d.healthy,
          unhealthy: d.unhealthy,
        }}
      />
    </div>
  )
}
