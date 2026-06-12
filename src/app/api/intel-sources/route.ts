import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/intel-sources — 供 n8n 工作流拉取情报源列表（公开端点）
 *
 * 鉴权: x-api-key header 或 body.secret_key，与 ai-publish 一致
 * 支持 ?active=true 仅返回启用的源
 * 支持 ?due=true 仅返回到期应采集的源
 */

export async function GET(req: Request) {
  // Auth — 复用 AI_WEBHOOK_SECRET
  const secret = req.headers.get('x-api-key')
  if (secret !== process.env.AI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const activeOnly = searchParams.get('active') === 'true'
  const dueOnly = searchParams.get('due') === 'true'

  try {
    const where: Record<string, unknown> = {}
    if (activeOnly) where.isActive = true

    let sources = (await db.intelSource.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { priority: 'asc' },
    })) as any[]

    // Filter for "due" (lastCrawl + interval < now)
    if (dueOnly) {
      const now = Date.now()
      sources = sources.filter((s: any) => {
        if (!s.lastCrawlAt) return true
        const elapsed = now - new Date(s.lastCrawlAt).getTime()
        return elapsed >= (s.crawlInterval || 30) * 60 * 1000
      })
    }

    return Response.json(sources)
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500 }
    )
  }
}
