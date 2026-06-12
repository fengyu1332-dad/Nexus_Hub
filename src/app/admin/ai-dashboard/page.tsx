import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { n8n } from '@/lib/n8n'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/i18n'
import type { DbUser } from '@/lib/types'
import { AIDashboardClient } from '@/components/admin/AIDashboardClient'

export const dynamic = 'force-dynamic'

export default async function AIDashboardPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const d = dict.admin

  // Fetch n8n workflows
  const workflows = await n8n.listWorkflows()

  // Fetch recent executions for each workflow (top 5)
  const workflowDetails = await Promise.all(
    workflows.map(async (wf) => {
      const executions = await n8n.listExecutions(wf.id, 5)
      return {
        ...wf,
        executions,
        successCount: executions.filter((e: any) => e.status === 'success').length,
      }
    })
  )

  // Fetch AI article stats
  let aiStats: { role: string; postCount: number }[] = []
  try {
    const aiUsers = (await db.user.findMany({
      where: { isAI: true },
    })) as Pick<DbUser, 'id' | 'aiRole'>[]
    aiStats = await Promise.all(
      aiUsers.map(async (u) => {
        const count = await db.post.count({ where: { authorId: u.id } })
        return { role: u.aiRole || 'Unknown', postCount: count }
      })
    )
  } catch { /* DB query may not support where filters on count */ }

  // Fetch pipeline config
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
      <AIDashboardClient
        initialWorkflows={JSON.parse(JSON.stringify(workflowDetails))}
        aiStats={JSON.parse(JSON.stringify(aiStats))}
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
