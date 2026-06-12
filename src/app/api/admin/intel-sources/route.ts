import { db } from '@/lib/db'
import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const IntelSourceValidator = z.object({
  label: z.string().min(1).max(100),
  url: z.string().min(1).max(500),
  type: z.enum(['rss', 'webpage']).default('webpage'),
  category: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  crawlInterval: z.number().min(5).max(1440).default(30),
  isActive: z.boolean().default(true),
  contentSelector: z.string().optional(),
})

// ── GET /api/admin/intel-sources ──────────────────────────

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === 'true'
  const dueOnly = searchParams.get('due') === 'true'
  const includeLogs = searchParams.get('logs') === 'true'

  const where: Record<string, unknown> = {}
  if (activeOnly) where.isActive = true

  const sources = (await db.intelSource.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: { priority: 'asc' },
  })) as any[]

  let result: any[] = sources

  // Filter for "due" sources (last_crawl + interval < now)
  if (dueOnly) {
    const now = Date.now()
    result = sources.filter((s: any) => {
      if (!s.lastCrawlAt) return true
      const elapsed = now - new Date(s.lastCrawlAt).getTime()
      return elapsed >= (s.crawlInterval || 30) * 60 * 1000
    })
  }

  // Include recent crawl logs (last 5 per source)
  if (includeLogs) {
    result = await Promise.all(
      result.map(async (s: any) => {
        try {
          const logs = await db.crawlLog.findMany({
            where: { sourceId: s.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
          return { ...s, recentLogs: logs }
        } catch {
          return { ...s, recentLogs: [] }
        }
      })
    )
  }

  return Response.json(result)
}

// ── POST /api/admin/intel-sources ─────────────────────────

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const body = await req.json().catch(() => null)
  if (!body) return new Response('Invalid JSON', { status: 400 })

  const parsed = IntelSourceValidator.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 })
  }

  const source = await db.intelSource.create({ data: parsed.data })
  return Response.json(source, { status: 201 })
}
