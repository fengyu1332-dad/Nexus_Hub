import { db } from '@/lib/db'
import { getAuthSession } from '@/lib/auth'
import { NextResponse } from 'next/server'

// POST — upsert feedback on an AI post (auth required)
export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { postId, rating, reason } = await req.json()
    if (!postId || !rating || !['helpful', 'not_helpful'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Only allow feedback on AI-authored posts
    const post = await db.post.findFirst({
      where: { id: postId },
      select: { id: true, authorId: true },
    })
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    const author = await db.user.findFirst({
      where: { id: (post as any).authorId },
      select: { isAI: true },
    })
    if (!(author as any)?.isAI) {
      return NextResponse.json({ error: 'Feedback only allowed on AI posts' }, { status: 400 })
    }

    const userId = session.user.id

    // Upsert: find existing, then create or update
    const existing = await db.postFeedback.findFirst({
      where: { postId, userId },
    })

    let feedback: any
    if (existing) {
      feedback = await db.postFeedback.update({
        where: { id: (existing as any).id },
        data: { rating, reason: reason || null },
      })
    } else {
      feedback = await db.postFeedback.create({
        data: { postId, userId, rating, reason: reason || null },
      })
    }

    return NextResponse.json({ success: true, feedback })
  } catch (err: any) {
    console.error('[post-feedback] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET — aggregate feedback stats for admin
export async function GET(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const postId = url.searchParams.get('postId')
    const userId = url.searchParams.get('userId')

    // Check if user already gave feedback for a specific post
    if (postId && userId) {
      const existing = await db.postFeedback.findFirst({
        where: { postId, userId },
      })
      return NextResponse.json({ feedback: existing })
    }

    // Aggregate for a specific post
    if (postId) {
      const feedbacks = await db.postFeedback.findMany({
        where: { postId },
        select: { id: true, rating: true, reason: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      const helpful = feedbacks.filter((f: any) => f.rating === 'helpful').length
      const notHelpful = feedbacks.filter((f: any) => f.rating === 'not_helpful').length
      return NextResponse.json({ feedbacks, helpful, notHelpful, total: feedbacks.length })
    }

    return NextResponse.json({ error: 'Missing postId or userId' }, { status: 400 })
  } catch (err: any) {
    console.error('[post-feedback] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
