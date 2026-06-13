/**
 * POST /api/proxy/browserless — 将请求转发到 browserless headless Chrome 服务
 *
 * 用途：解决 n8n HTTP Request 节点向 Docker 内网服务发 POST 时的 body 校验问题。
 * n8n → Next.js API 的 POST 请求已验证可行，Next.js 再转发到 browserless。
 *
 * 健壮性：无论 browserless 返回什么，本端点始终返回 200，
 * 避免 n8n 因 HTTP 错误状态码中断整个管线。
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

    let html: string
    try {
      const response = await fetch(browserlessUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: body.url }),
        signal: AbortSignal.timeout(60000),
      })
      html = await response.text()
    } catch (fetchErr: any) {
      // 超时或连接错误也返回 200，避免 n8n 报错中断管线
      html = `BROWSERLESS_ERROR: ${fetchErr.message || String(fetchErr)}`
    }

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e: any) {
    // 即使 JSON 解析失败也返回纯文本，确保 n8n 不阻塞
    return new Response(`PROXY_ERROR: ${e.message || String(e)}`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
