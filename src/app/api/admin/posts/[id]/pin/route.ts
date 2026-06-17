import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const post = await db.post.findFirst({
      where: { id: params.id },
      select: { isPinned: true },
    }) as { isPinned: boolean } | null

    if (!post) return new Response('Not found', { status: 404 })

    const newPinned = !post.isPinned
    await db.post.update({
      where: { id: params.id },
      data: {
        isPinned: newPinned,
        pinnedAt: newPinned ? new Date().toISOString() : null,
      },
    })

    return new Response(JSON.stringify({ isPinned: newPinned }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[admin-pin] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not toggle pin', { status: 500 })
  }
}
