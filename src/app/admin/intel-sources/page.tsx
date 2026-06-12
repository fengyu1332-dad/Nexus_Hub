import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/i18n'
import type { DbIntelSource, DbCrawlLog } from '@/lib/types'
import { IntelSourcesClient } from '@/components/admin/IntelSourcesClient'

export const dynamic = 'force-dynamic'

export default async function IntelSourcesPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const d = dict.admin

  // Fetch all sources with recent logs
  let sources: (DbIntelSource & { recentLogs: DbCrawlLog[] })[] = []
  try {
    const rawSources = (await db.intelSource.findMany({
      orderBy: { priority: 'asc' },
    })) as DbIntelSource[]

    sources = await Promise.all(
      rawSources.map(async (s) => {
        try {
          const logs = (await db.crawlLog.findMany({
            where: { sourceId: s.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })) as DbCrawlLog[]
          return { ...s, recentLogs: logs }
        } catch {
          return { ...s, recentLogs: [] }
        }
      })
    )
  } catch {
    sources = []
  }

  return (
    <div className='space-y-8'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold text-zinc-900'>{d.intelSources}</h1>
      </div>
      <IntelSourcesClient
        initialSources={JSON.parse(JSON.stringify(sources))}
        labels={{
          intelSources: d.intelSources,
          addSource: d.addSource,
          editSource: d.editSource,
          label: d.intelSources,
          url: d.url,
          type: d.type,
          rss: d.rss,
          webpage: d.webpage,
          category: d.category,
          priority: d.priority,
          crawlInterval: d.crawlInterval,
          minutes: d.minutes,
          contentSelector: d.contentSelector,
          active: d.enabled,
          inactive: d.disabled,
          testCrawl: d.testCrawl,
          testResult: d.testResult,
          preview: d.preview,
          save: d.save,
          delete: d.delete,
          lastCrawl: d.lastCrawl,
          articleCount: d.articleCount,
          crawlCount: d.crawlCount,
          crawlLogs: d.crawlLogs,
          noLogs: d.noLogs,
          circuitBreaker: d.circuitBreaker,
          resetCircuitBreaker: d.resetCircuitBreaker,
          duration: d.duration,
          contentLength: d.contentLength,
          successRate: d.successRate,
          healthy: d.healthy,
          unhealthy: d.unhealthy,
        }}
      />
    </div>
  )
}
