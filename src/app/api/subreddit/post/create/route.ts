import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { PostValidator } from '@/lib/validators/post'
import { z } from 'zod'
import { checkContentQuality } from '@/lib/moderation'

function extractTextFromBlocks(blocks: any): string {
  if (!blocks || !Array.isArray(blocks)) return ''
  return blocks
    .map((b: any) => {
      if (typeof b.data?.text === 'string') return b.data.text
      if (typeof b.data?.items === 'object') return JSON.stringify(b.data.items)
      return ''
    })
    .filter(Boolean)
    .join(' ')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { title, content, subredditId } = PostValidator.parse(body)

    const session = await getAuthSession()

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Moderation check
    try {
      const textContent = extractTextFromBlocks(content)
      const moderationResult = await checkContentQuality(
        `${title} ${textContent}`,
        'post'
      )
      if (!moderationResult.passed) {
        return new Response(
          JSON.stringify({
            error: 'moderation_failed',
            flags: moderationResult.flags,
            sensitiveWords: moderationResult.sensitiveWords,
            message: '内容包含敏感词或不符合社区规范，请修改后重试',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      // Moderation error — allow post through (don't block legitimate content)
    }

    // verify user is subscribed to passed subreddit id
    const subscription = await db.subscription.findFirst({
      where: {
        subredditId,
        userId: session.user.id,
      },
    })

    if (!subscription) {
      return new Response('Subscribe to post', { status: 403 })
    }

    const post = (await db.post.create({
      data: {
        title,
        content,
        authorId: session.user.id,
        subredditId,
      },
    })) as any

    // Async embedding generation (fire-and-forget, don't block response)
    const postId = post?.id
    if (postId) {
      Promise.resolve().then(async () => {
        try {
          const { getEmbedding } = await import('@/lib/embedding')
          const textContent = extractTextFromBlocks(content)
          const textForEmbedding = (title + ' ' + textContent).substring(0, 8000)
          const embedding = await Promise.race([
            getEmbedding(textForEmbedding),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ])
          if (embedding && embedding.length > 0) {
            await db.post.update({
              where: { id: postId },
              data: { embedding },
            } as any)
          }
        } catch {
          // Non-fatal: post is created, just missing embedding
        }
      })
    }

    return new Response('OK')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }

    return new Response(
      'Could not post to subreddit at this time. Please try later',
      { status: 500 }
    )
  }
}
