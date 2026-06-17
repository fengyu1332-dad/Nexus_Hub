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

    const { title, content, subredditId, status: postStatus } = PostValidator.parse(body)

    const session = await getAuthSession()

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const isDraft = postStatus === 'DRAFT'

    // Moderation check (skip for drafts)
    if (!isDraft) {
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
    }

    // verify user is subscribed to passed subreddit id (skip for drafts)
    if (!isDraft) {
      const subscription = await db.subscription.findFirst({
        where: {
          subredditId,
          userId: session.user.id,
        },
      })

      if (!subscription) {
        return new Response('Subscribe to post', { status: 403 })
      }
    }

    const post = (await db.post.create({
      data: {
        title,
        content,
        authorId: session.user.id,
        subredditId,
        status: postStatus || 'PUBLISHED',
      },
    })) as any

    // Async embedding generation (fire-and-forget with retry, skip for drafts)
    const postId = post?.id
    if (postId && !isDraft) {
      Promise.resolve().then(async () => {
        try {
          const { generateEmbeddingWithRetry } = await import('@/lib/embedding-job')
          const textContent = extractTextFromBlocks(content)
          await generateEmbeddingWithRetry(postId, title, textContent)
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
