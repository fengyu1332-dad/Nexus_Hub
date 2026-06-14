import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'ids array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let deleted = 0
    let failed = 0

    for (const id of ids) {
      try {
        await db.post.delete({ where: { id } })
        deleted++
      } catch {
        failed++
      }
    }

    return new Response(JSON.stringify({ deleted, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
