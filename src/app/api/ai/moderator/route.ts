import { runModeration } from '@/lib/moderator/moderator-pipeline'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/moderator
 * 由 n8n 定时触发（如每 30 分钟），扫描新帖并执行垃圾清理/精华推荐。
 *
 * 鉴权: x-api-key 或 body.secret_key = AI_WEBHOOK_SECRET
 * Body: { secret_key?: string, maxScan?: number }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const maxScan = body.maxScan
      ? Math.min(body.maxScan, 100)
      : undefined

    const report = await runModeration(maxScan)

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[ai-moderator] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Moderation run failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * GET /api/ai/moderator?secret=AI_WEBHOOK_SECRET&maxScan=50
 * 兼容 Vercel Cron 调用。
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    if (secret !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const maxScan = url.searchParams.get('maxScan')
    const max = maxScan ? Math.min(parseInt(maxScan, 10), 100) : undefined

    const report = await runModeration(max)

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[ai-moderator] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Moderation run failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
