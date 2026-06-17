import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET — list tags with optional category and query filters
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const category = url.searchParams.get('category')
    const query = url.searchParams.get('query')

    const where: any = {}
    if (category) where.category = category

    const tags = await db.tag.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { postCount: 'desc' },
      take: 100,
      select: { id: true, name: true, slug: true, category: true, postCount: true },
    })

    let result = tags || []

    // Client-side filtering for query (ilike not reliably supported for Chinese in Supabase REST)
    if (query) {
      const q = query.toLowerCase()
      result = result.filter(
        (t: any) =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.slug || '').toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ tags: result })
  } catch (err: any) {
    console.error('[tags] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
