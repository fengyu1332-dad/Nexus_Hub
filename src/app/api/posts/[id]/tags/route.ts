import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { NextResponse } from 'next/server'

// GET — get tags for a post
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: postId } = params

    const postTags = await db.postTag.findMany({
      where: { postId },
      select: { id: true, tagId: true },
    })

    if (!postTags.length) {
      return NextResponse.json({ tags: [] })
    }

    const tagIds = postTags.map((pt: any) => pt.tagId)
    const tags = await db.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true, slug: true, category: true },
    })

    return NextResponse.json({ tags })
  } catch (err: any) {
    console.error('[posts/tags] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — add a tag to a post (admin only)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: postId } = params
    const { tagId } = await req.json()
    if (!tagId) {
      return NextResponse.json({ error: 'Missing tagId' }, { status: 400 })
    }

    const tag = await db.tag.findFirst({ where: { id: tagId } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Avoid duplicate
    const existing = await db.postTag.findMany({
      where: { postId, tagId },
    })
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Tag already linked' }, { status: 409 })
    }

    const postTag = await db.postTag.create({ data: { postId, tagId } })

    // Update tag count
    await db.tag.update({
      where: { id: tagId },
      data: { postCount: ((tag as any).postCount || 0) + 1 },
    })

    return NextResponse.json({ postTag })
  } catch (err: any) {
    console.error('[posts/tags] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — remove a tag from a post (admin only)
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: postId } = params
    const { tagId } = await req.json()
    if (!tagId) {
      return NextResponse.json({ error: 'Missing tagId' }, { status: 400 })
    }

    const postTags = await db.postTag.findMany({
      where: { postId, tagId },
    })
    if (!postTags.length) {
      return NextResponse.json({ error: 'Tag not linked' }, { status: 404 })
    }

    await db.postTag.delete({ where: { id: (postTags[0] as any).id } })

    // Decrement tag count
    const tag = await db.tag.findFirst({ where: { id: tagId } })
    if (tag) {
      await db.tag.update({
        where: { id: tagId },
        data: { postCount: Math.max(0, ((tag as any).postCount || 0) - 1) },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[posts/tags] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
