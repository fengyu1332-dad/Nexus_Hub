import { db } from '@/lib/db'
import { z } from 'zod'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const DedupValidator = z.object({
  url: z.string().url(),
  title: z.string(),
  contentHash: z.string().optional(),
})

/**
 * POST /api/intel-sources/dedup-check — 内容去重检查
 *
 * 由 n8n 工作流在抓取后、生成文章前调用。
 * 通过 contentHash (SHA256) 检查是否已存在相同/高度相似内容。
 * 返回 { isDuplicate, existingPostId? }
 */

function hashContent(text: string): string {
  return crypto.createHash('sha256').update(text.substring(0, 2000)).digest('hex')
}

export async function POST(req: Request) {
  // Auth
  const body = await req.json().catch(() => null)
  if (!body) return new Response('Invalid JSON', { status: 400 })

  const secretKey = body.secret_key || req.headers.get('x-api-key')
  if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const parsed = DedupValidator.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 })
  }

  const { url, title, contentHash: providedHash } = parsed.data

  try {
    // Check by content hash
    const hash = providedHash || hashContent(title + url)

    // Check recent crawl logs for same hash
    const recentLogs = (await db.crawlLog.findMany({
      where: { contentHash: hash },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })) as any[]

    const duplicateLog = recentLogs.find((l: any) => l.status === 'success')
    if (duplicateLog) {
      return Response.json({
        isDuplicate: true,
        existingPostId: duplicateLog.postId || null,
        reason: 'content_hash_match',
        matchedAt: duplicateLog.createdAt,
      })
    }

    // Check by exact title (looser check)
    const titleMatch = (await db.crawlLog.findMany({
      where: { title },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })) as any[]

    const titleDup = titleMatch.find((l: any) => l.status === 'success')
    if (titleDup) {
      return Response.json({
        isDuplicate: true,
        existingPostId: titleDup.postId || null,
        reason: 'exact_title_match',
        matchedAt: titleDup.createdAt,
      })
    }

    return Response.json({ isDuplicate: false })
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || String(e) }),
      { status: 500 }
    )
  }
}
