import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { CommentValidator } from '@/lib/validators/comment'
import { z } from 'zod'
import { checkContentQuality } from '@/lib/moderation'

export async function PATCH(req: Request) {
  try {
    const body = await req.json()

    const { postId, text, replyToId } = CommentValidator.parse(body)

    const session = await getAuthSession()

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Moderation check
    try {
      const moderationResult = await checkContentQuality(text, 'comment')
      if (!moderationResult.passed) {
        return new Response(
          JSON.stringify({
            error: 'moderation_failed',
            flags: moderationResult.flags,
            sensitiveWords: moderationResult.sensitiveWords,
            message: '评论包含敏感词或不符合社区规范，请修改后重试',
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      // Moderation error — allow through
    }

    await db.comment.create({
      data: {
        text,
        postId,
        authorId: session.user.id,
        replyToId,
      },
    })

    // Create notification for the parent comment author (if replying)
    if (replyToId) {
      const parentComment = await db.comment.findFirst({
        where: { id: replyToId },
        select: { authorId: true, postId: true },
      })
      if (parentComment && parentComment.authorId !== session.user.id) {
        try {
          await db.notification.create({
            data: {
              userId: parentComment.authorId,
              type: 'COMMENT_REPLY',
              fromUserId: session.user.id,
              postId: parentComment.postId,
              commentId: replyToId,
            },
          })
        } catch {
          // Don't fail the comment if notification creation fails
        }
      }
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
