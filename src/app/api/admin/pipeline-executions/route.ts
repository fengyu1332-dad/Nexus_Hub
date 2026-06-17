import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const url = new URL(req.url)
  const pipelineType = url.searchParams.get('type') || undefined
  const status = url.searchParams.get('status') || undefined
  const limit = parseInt(url.searchParams.get('limit') || '50')

  try {
    const where: Record<string, any> = {}
    if (pipelineType) where.pipelineType = pipelineType
    if (status) where.status = status

    const executions = await db.pipelineExecution.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    })

    return new Response(JSON.stringify(executions || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[pipeline-executions] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Failed to fetch pipeline executions', { status: 500 })
  }
}
