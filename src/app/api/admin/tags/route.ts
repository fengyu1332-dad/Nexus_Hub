import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { NextResponse } from 'next/server'

// POST — create a new tag
export async function POST(req: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, slug, category } = await req.json()
    if (!name) {
      return NextResponse.json({ error: 'Missing tag name' }, { status: 400 })
    }

    const tagSlug = slug || name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-+|-+$/g, '')

    // Check for existing slug
    const existing = await db.tag.findFirst({ where: { slug: tagSlug } })
    if (existing) {
      return NextResponse.json({ error: 'Tag slug already exists' }, { status: 409 })
    }

    const tag = await db.tag.create({
      data: { name, slug: tagSlug, category: category || null, postCount: 0 },
    })

    return NextResponse.json({ tag })
  } catch (err: any) {
    console.error('[admin/tags] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
