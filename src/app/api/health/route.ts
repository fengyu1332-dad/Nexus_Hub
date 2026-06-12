import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { n8n } from '@/lib/n8n'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const startTime = Date.now()

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs: number; error?: string }> = {}

  // DB check
  const dbStart = Date.now()
  try {
    await db.user.count({ where: {} })
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (e) {
    checks.database = { status: 'error', latencyMs: Date.now() - dbStart, error: String(e) }
    logger.error('Health check: DB failed', { error: String(e) })
  }

  // Redis check
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
  } catch (e) {
    checks.redis = { status: 'error', latencyMs: Date.now() - redisStart, error: String(e) }
    logger.error('Health check: Redis failed', { error: String(e) })
  }

  // n8n check
  const n8nStart = Date.now()
  try {
    const online = await n8n.ping()
    checks.n8n = online
      ? { status: 'ok', latencyMs: Date.now() - n8nStart }
      : { status: 'error', latencyMs: Date.now() - n8nStart, error: 'n8n unreachable' }
  } catch (e) {
    checks.n8n = { status: 'error', latencyMs: Date.now() - n8nStart, error: String(e) }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok')
  const uptimeMs = Date.now() - startTime

  const body = JSON.stringify({
    status: allHealthy ? 'healthy' : 'degraded',
    uptimeMs,
    uptimeHuman: `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m ${Math.floor((uptimeMs % 60000) / 1000)}s`,
    checks,
    timestamp: new Date().toISOString(),
  })

  return new Response(body, {
    status: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
  })
}
