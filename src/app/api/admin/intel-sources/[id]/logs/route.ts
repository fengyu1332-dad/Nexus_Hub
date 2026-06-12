import { db } from '@/lib/db'
import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/intel-sources/[id]/logs — 某个源的采集日志
 */

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const skip = (page - 1) * limit

  const [logs, total] = await Promise.all([
    db.crawlLog.findMany({
      where: { sourceId: params.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    }),
    db.crawlLog.count({ where: { sourceId: params.id } }),
  ])

  return Response.json({ logs, total, page, limit })
}
