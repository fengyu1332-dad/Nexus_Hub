import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    await db.post.delete({ where: { id: params.id } })
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('[admin-posts-delete] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not delete post', { status: 500 })
  }
}
