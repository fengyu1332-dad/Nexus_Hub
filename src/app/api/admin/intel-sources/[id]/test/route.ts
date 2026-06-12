import { db } from '@/lib/db'
import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/intel-sources/[id]/test — 干运行测试抓取
 *
 * 调用 browserless 获取网页内容，返回标题 + 清洗后正文预览。
 * 不写入数据库。用于管理员评估情报源质量。
 */

const BROWSERLESS_URL =
  process.env.BROWSERLESS_URL || 'http://localhost:3333/content'

function stripHtml(h: string): string {
  return h
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match
    ? match[1]
        .trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
    : '未知标题'
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const source = await db.intelSource.findFirst({ where: { id: params.id } })
  if (!source) return new Response('Source not found', { status: 404 })

  const t0 = Date.now()

  try {
    // RSS 类型：直接 fetch 解析 XML
    if ((source as any).type === 'rss') {
      const res = await fetch((source as any).url, {
        headers: { 'User-Agent': 'NexusHub/1.0' },
      })
      if (!res.ok) {
        return Response.json({
          status: 'failed',
          error: `HTTP ${res.status}`,
          duration: Date.now() - t0,
        })
      }
      const xml = await res.text()
      const cleaned = stripHtml(xml)
      const title = extractTitle(xml)
      return Response.json({
        status: 'success',
        type: 'rss',
        title,
        contentPreview: cleaned.substring(0, 500),
        contentLength: cleaned.length,
        duration: Date.now() - t0,
      })
    }

    // 网页类型：调用 browserless
    const scrapeRes = await fetch(BROWSERLESS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: (source as any).url }),
    })

    if (!scrapeRes.ok) {
      return Response.json({
        status: 'failed',
        error: `Browserless HTTP ${scrapeRes.status}`,
        duration: Date.now() - t0,
      })
    }

    const html = await scrapeRes.text()
    const cleaned = stripHtml(html)
    const title = extractTitle(html)
    const contentSelector = (source as any).contentSelector

    // 如果配置了 CSS 选择器，尝试精准提取
    let targetedContent = cleaned
    if (contentSelector) {
      const selectorRegex = new RegExp(
        `<${contentSelector}[^>]*>([\\s\\S]*?)<\\/${contentSelector}>`,
        'i'
      )
      const match = html.match(selectorRegex)
      if (match) {
        targetedContent = stripHtml(match[1])
      }
    }

    const preview = targetedContent || cleaned

    return Response.json({
      status: 'success',
      type: 'webpage',
      title,
      contentPreview: preview.substring(0, 500),
      contentLength: preview.length,
      duration: Date.now() - t0,
      usedSelector: !!contentSelector && !!targetedContent,
    })
  } catch (e: any) {
    return Response.json({
      status: 'failed',
      error: e.message || String(e),
      duration: Date.now() - t0,
    })
  }
}
