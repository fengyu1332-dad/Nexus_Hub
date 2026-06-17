import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const session = await getAdminSession()
    if (!session) return new Response('Unauthorized', { status: 401 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    const reports = (await db.report.findMany({
      where: status !== 'all' ? { status } : {},
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })) as any[]

    // Batch resolve reporter usernames
    const reporterIds = Array.from(new Set(reports.map((r: any) => r.reporterId))) as string[]
    const reporterMap = new Map<string, string>()
    for (const rid of reporterIds) {
      const u = await db.user.findFirst({
        where: { id: rid },
        select: { username: true },
      })
      if (u) reporterMap.set(rid, (u as any).username || 'unknown')
    }

    const enriched = reports.map((r: any) => ({
      ...r,
      reporterUsername: reporterMap.get(r.reporterId) || 'unknown',
    }))

    return new Response(
      JSON.stringify({ reports: enriched, page, limit }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[admin/reports] Error:', error)
    return new Response(
      JSON.stringify({ reports: [], error: 'Failed to fetch reports' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession()
    if (!session) return new Response('Unauthorized', { status: 401 })

    const body = await req.json()
    const { reportId, status } = body

    if (!reportId || !['resolved', 'dismissed'].includes(status)) {
      return new Response('Invalid request', { status: 400 })
    }

    await db.report.update({
      where: { id: reportId },
      data: {
        status,
        resolvedAt: new Date().toISOString(),
        resolvedById: (session.user as any).id,
      },
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[admin/reports] Error:', error)
    return new Response('Could not update report', { status: 500 })
  }
}
