import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CrawlLogValidator = z.object({
  sourceId: z.string().min(1),
  status: z.enum(['success', 'failed', 'deduplicated']),
  url: z.string().optional(),
  title: z.string().optional(),
  contentHash: z.string().optional(),
  contentLength: z.number().optional(),
  errorMessage: z.string().optional(),
  postId: z.string().optional(),
  duration: z.number().optional(),
})

/**
 * POST /api/intel-sources/crawl-log — 记录采集日志
 *
 * 由 n8n 工作流在每次抓取后调用。
 * 写入 CrawlLog 并更新对应 IntelSource 的统计字段。
 * 自动处理熔断计数：成功清零，失败+1，达到阈值自动停用。
 */

export async function POST(req: Request) {
  // Auth
  const body = await req.json().catch(() => null)
  if (!body) return new Response('Invalid JSON', { status: 400 })

  const secretKey = body.secret_key || req.headers.get('x-api-key')
  if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const parsed = CrawlLogValidator.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 })
  }

  const { sourceId, status, ...logData } = parsed.data

  try {
    // Write crawl log
    const log = await db.crawlLog.create({
      data: { sourceId, status, ...logData },
    })

    // Update source stats
    const source = await db.intelSource.findFirst({ where: { id: sourceId } })
    if (source) {
      const s = source as any
      const updateData: Record<string, unknown> = {
        lastCrawlAt: new Date().toISOString(),
        crawlCount: (s.crawlCount || 0) + 1,
      }

      if (status === 'success') {
        updateData.consecutiveFailures = 0
        updateData.lastError = null
        if (logData.postId) {
          updateData.articleCount = (s.articleCount || 0) + 1
        }
      } else {
        const newFailures = (s.consecutiveFailures || 0) + 1
        updateData.consecutiveFailures = newFailures
        updateData.lastError = logData.errorMessage || status

        // Auto circuit breaker
        if (newFailures >= (s.maxFailures || 5)) {
          updateData.isActive = false
          console.warn(
            `[intel-sources] Source "${s.label}" auto-disabled after ${newFailures} consecutive failures`
          )
        }
      }

      await db.intelSource.update({ where: { id: sourceId }, data: updateData })
    }

    return Response.json(log, { status: 201 })
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500 }
    )
  }
}
