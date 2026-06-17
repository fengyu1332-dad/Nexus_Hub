import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ReportValidator } from '@/lib/validators/report'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { targetType, targetId, reason, description } = ReportValidator.parse(body)

    // Check for duplicate
    const existing = await db.report.findFirst({
      where: {
        reporterId: (session.user as any).id,
        targetType,
        targetId,
      },
    })
    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Already reported' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await db.report.create({
      data: {
        reporterId: (session.user as any).id,
        targetType,
        targetId,
        reason,
        description: description || null,
      },
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return new Response('Invalid request', { status: 400 })
    }
    console.error('[reports] Error:', error)
    return new Response('Could not create report', { status: 500 })
  }
}
