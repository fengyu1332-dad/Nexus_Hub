import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const url = new URL(req.url)
  const pipelineType = url.searchParams.get('type') || undefined
  const status = url.searchParams.get('status') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const aggregate = url.searchParams.get('aggregate') === 'true'

  try {
    // ── Aggregate mode: Group by type+status ──────────────
    if (aggregate) {
      const executions = await db.pipelineExecution.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
      }) as { pipelineType: string; status: string; durationMs: number | null }[] | null

      if (!executions || !executions.length) {
        return new Response(JSON.stringify({ total: 0, byType: [], overallSuccessRate: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const typeMap = new Map<string, { total: number; success: number; failed: number; dead: number; pending: number; avgDuration: number; durationCount: number }>()

      for (const e of executions) {
        if (!typeMap.has(e.pipelineType)) {
          typeMap.set(e.pipelineType, { total: 0, success: 0, failed: 0, dead: 0, pending: 0, avgDuration: 0, durationCount: 0 })
        }
        const entry = typeMap.get(e.pipelineType)!
        entry.total++
        if (e.status === 'success') entry.success++
        else if (e.status === 'failed') entry.failed++
        else if (e.status === 'dead_letter') entry.dead++
        else entry.pending++
        if (e.durationMs != null) {
          entry.avgDuration += e.durationMs
          entry.durationCount++
        }
      }

      const byType = Array.from(typeMap.entries()).map(([type, counts]) => ({
        pipelineType: type,
        total: counts.total,
        success: counts.success,
        failed: counts.failed,
        dead: counts.dead,
        pending: counts.pending,
        successRate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
        avgDurationMs: counts.durationCount > 0 ? Math.round(counts.avgDuration / counts.durationCount) : null,
      }))

      const total = executions.length
      const totalSuccess = executions.filter((e: any) => e.status === 'success').length

      return new Response(JSON.stringify({
        total,
        totalSuccess,
        overallSuccessRate: total > 0 ? Math.round((totalSuccess / total) * 100) : 0,
        byType,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ── Normal list mode ──────────────────────────────────
    const where: Record<string, any> = {}
    if (pipelineType) where.pipelineType = pipelineType
    if (status) where.status = status

    const executions = await db.pipelineExecution.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    })

    return new Response(JSON.stringify(executions || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[pipeline-executions] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Failed to fetch pipeline executions', { status: 500 })
  }
}
