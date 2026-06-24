import { buildAtmosphere } from '@/lib/atmosphere/atmosphere-builder'

export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/atmosphere-builder
 * 由 n8n 定时触发（如每 20 分钟），扫描帖子并按时间线创建 AI 评论。
 *
 * 鉴权: x-api-key 或 body.secret_key = AI_WEBHOOK_SECRET
 * Body: { secret_key?: string, maxNewComments?: number, forceRun?: boolean }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const maxNewComments = body.maxNewComments
      ? Math.min(body.maxNewComments, 20)
      : undefined

    const report = await buildAtmosphere(maxNewComments)

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[atmosphere-builder] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Atmosphere build failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * GET /api/ai/atmosphere-builder?secret=AI_WEBHOOK_SECRET
 * 兼容 Vercel Cron 调用。
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    if (secret !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const maxNewComments = url.searchParams.get('maxNewComments')
    const max = maxNewComments ? Math.min(parseInt(maxNewComments, 10), 20) : undefined

    const report = await buildAtmosphere(max)

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[atmosphere-builder] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Atmosphere build failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
