import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { NextResponse } from 'next/server'

// PUT — update a tag name or category
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { name, category } = await req.json()

    const tag = await db.tag.findFirst({ where: { id } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const updates: Record<string, any> = {}
    if (name !== undefined) {
      updates.name = name
      // Regenerate slug from name
      updates.slug = name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-+|-+$/g, '')
    }
    if (category !== undefined) updates.category = category || null

    const updated = await db.tag.update({ where: { id }, data: updates })
    return NextResponse.json({ tag: updated })
  } catch (err: any) {
    console.error('[admin/tags] PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — remove a tag
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    const tag = await db.tag.findFirst({ where: { id } })
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Delete all PostTag links first
    const postTags = await db.postTag.findMany({ where: { tagId: id } })
    for (const pt of postTags) {
      await db.postTag.delete({ where: { id: (pt as any).id } })
    }

    await db.tag.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[admin/tags] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
