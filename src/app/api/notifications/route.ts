import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: { fromUser: { select: { username: true, image: true } } },
    })

    const unreadCount = await db.notification.count({
      where: { userId: session.user.id, read: false },
    })

    return new Response(JSON.stringify({ notifications, unreadCount }))
  } catch (error) {
    return new Response('Could not fetch notifications', { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()

    if (body.all) {
      await db.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      })
    } else if (body.ids?.length) {
      for (const id of body.ids) {
        await db.notification.update({
          where: { id },
          data: { read: true },
        })
      }
    }

    return new Response('OK')
  } catch (error) {
    return new Response('Could not update notifications', { status: 500 })
  }
}
