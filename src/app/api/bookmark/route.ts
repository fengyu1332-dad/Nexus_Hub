import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { postId } = await req.json()
    if (!postId) {
      return new Response('Missing postId', { status: 400 })
    }

    const existing = await db.bookmark.findFirst({
      where: { userId: session.user.id, postId },
    })

    if (existing) {
      await db.bookmark.delete({
        where: {
          userId_postId: { userId: session.user.id, postId },
        },
      })
      return new Response(JSON.stringify({ saved: false }))
    } else {
      await db.bookmark.create({
        data: { userId: session.user.id, postId },
      })
      return new Response(JSON.stringify({ saved: true }))
    }
  } catch (error) {
    return new Response('Could not toggle bookmark', { status: 500 })
  }
}
