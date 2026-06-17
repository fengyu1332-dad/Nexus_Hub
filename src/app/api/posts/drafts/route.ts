import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const DraftUpdateValidator = z.object({
  postId: z.string().min(1),
  title: z.string().min(3).max(128).optional(),
  content: z.any().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

export async function GET() {
  try {
    const session = await getAuthSession()
    if (!session?.user) return new Response('Unauthorized', { status: 401 })

    const userId = (session.user as any).id as string
    const drafts = (await db.post.findMany({
      where: { authorId: userId, status: 'DRAFT' },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        updatedAt: true,
        subredditId: true,
      },
    })) as any[]

    // Batch resolve subreddit names
    const subIds = Array.from(new Set(drafts.map((d: any) => d.subredditId))) as string[]
    const subMap = new Map<string, string>()
    for (const sid of subIds) {
      const s = await db.subreddit.findFirst({ where: { id: sid }, select: { name: true } })
      if (s) subMap.set(sid, (s as any).name)
    }

    return new Response(
      JSON.stringify(drafts.map((d: any) => ({
        ...d,
        subredditName: subMap.get(d.subredditId) || 'Unknown',
        updatedAt: d.updatedAt?.toISOString?.() || d.updatedAt,
      }))),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[drafts] Error:', error)
    return new Response('Failed to fetch drafts', { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) return new Response('Unauthorized', { status: 401 })

    const body = await req.json()
    const { postId, title, content, status } = DraftUpdateValidator.parse(body)
    const userId = (session.user as any).id

    // Verify ownership
    const existing = (await db.post.findFirst({
      where: { id: postId },
      select: { authorId: true },
    })) as { authorId: string } | null
    if (!existing || existing.authorId !== userId) {
      return new Response('Not found', { status: 404 })
    }

    const data: Record<string, any> = {}
    if (title !== undefined) data.title = title
    if (content !== undefined) data.content = content
    if (status) data.status = status

    await db.post.update({ where: { id: postId }, data })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    if (error?.name === 'ZodError') return new Response('Invalid', { status: 400 })
    console.error('[drafts] Error:', error)
    return new Response('Failed to update draft', { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) return new Response('Unauthorized', { status: 401 })

    const body = await req.json()
    const { postId } = body
    const userId = (session.user as any).id

    const existing = (await db.post.findFirst({
      where: { id: postId },
      select: { authorId: true },
    })) as { authorId: string } | null
    if (!existing || existing.authorId !== userId) {
      return new Response('Not found', { status: 404 })
    }

    await db.post.delete({ where: { id: postId } })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[drafts] Error:', error)
    return new Response('Failed to delete draft', { status: 500 })
  }
}
