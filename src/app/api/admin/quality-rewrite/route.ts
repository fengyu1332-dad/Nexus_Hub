import { getAdminSession } from '@/lib/auth-admin'
import { detectLowQualityPosts, autoRewritePost } from '@/lib/quality-detector'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET: 列出低质量帖子
export async function GET(req: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')

  try {
    const posts = await detectLowQualityPosts(Math.min(days, 30))
    return NextResponse.json({ posts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST: 改写指定帖子
export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { postId, originalTitle, originalContent } = body

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    const result = await autoRewritePost(postId, originalTitle || '', originalContent)

    if (!result) {
      return NextResponse.json({ error: 'Rewrite failed. Check DEEPSEEK_API_KEY and post existence.' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
