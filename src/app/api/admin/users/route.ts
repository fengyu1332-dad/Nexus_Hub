import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const search = searchParams.get('search') || ''

    const where: Record<string, any> = search
      ? { username: { contains: search } }
      : {}

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: { id: true, username: true, email: true, image: true, isAI: true, aiRole: true, isAdmin: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { username: 'asc' },
      }),
      db.user.count({ where }),
    ])

    return new Response(JSON.stringify({ users, total, page, limit }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[admin-users] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not fetch users', { status: 500 })
  }
}
