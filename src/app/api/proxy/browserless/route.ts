/**
 * POST /api/proxy/browserless — 将请求转发到 browserless headless Chrome 服务
 *
 * 用途：解决 n8n HTTP Request 节点向 Docker 内网服务发 POST 时的 body 校验问题。
 * n8n → Next.js API 的 POST 请求已验证可行，Next.js 再转发到 browserless。
 */

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Auth
  const secret = req.headers.get('x-api-key')
  if (secret !== process.env.AI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json()

    const browserlessUrl =
      process.env.BROWSERLESS_URL || 'http://localhost:3333/content'

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: body.url }),
      signal: AbortSignal.timeout(30000),
    })

    const html = await response.text()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500 }
    )
  }
}
