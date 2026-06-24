import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { PostVoteValidator } from '@/lib/validators/vote'
import { CachedPost } from '@/types/redis'
import { z } from 'zod'

const CACHE_AFTER_UPVOTES = 1

function computeHotScore(votesAmt: number, createdAt: Date): number {
  return Math.log10(Math.max(Math.abs(votesAmt), 1))
    + (createdAt.getTime() / 1000 - 1134028003) / 45000
}

async function updatePostScore(postId: string, votesAmt: number, createdAt: Date | string) {
  const ctime = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const hotScore = computeHotScore(votesAmt, ctime)
  await db.post.update({
    where: { id: postId },
    data: { voteCount: votesAmt, hotScore },
  })
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()

    const { postId, voteType } = PostVoteValidator.parse(body)

    const session = await getAuthSession()

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // check if user has already voted on this post
    const existingVote = await db.vote.findFirst({
      where: {
        userId: session.user.id,
        postId,
      },
    })

    const post = await db.post.findUnique({
      where: {
        id: postId,
      },
      include: {
        author: true,
        votes: true,
      },
    })

    if (!post) {
      return new Response('Post not found', { status: 404 })
    }

    // Compute base vote count from pre-mutation state
    const baseAmt = post.votes.reduce((acc, vote) => {
      if (vote.type === 'UP') return acc + 1
      if (vote.type === 'DOWN') return acc - 1
      return acc
    }, 0)

    if (existingVote) {
      // if vote type is the same as existing vote, delete the vote
      if (existingVote.type === voteType) {
        await db.vote.delete({
          where: {
            userId_postId: {
              postId,
              userId: session.user.id,
            },
          },
        })

        // Remove the deleted vote from count
        const votesAmt = baseAmt - (existingVote.type === 'UP' ? 1 : -1)

        if (votesAmt >= CACHE_AFTER_UPVOTES) {
          const cachePayload: CachedPost = {
            authorUsername: post.author.username ?? '',
            content: JSON.stringify(post.content),
            id: post.id,
            title: post.title,
            currentVote: null,
            createdAt: post.createdAt,
            isAIGenerated: post.author.isAI,
          }

          await redis.hset(`post:${postId}`, cachePayload)
        }

        await updatePostScore(postId, votesAmt, post.createdAt)

        return new Response('OK')
      }

      // if vote type is different, update the vote
      await db.vote.update({
        where: {
          userId_postId: {
            postId,
            userId: session.user.id,
          },
        },
        data: {
          type: voteType,
        },
      })

      // Replace old vote value with new vote value
      const votesAmt = baseAmt - (existingVote.type === 'UP' ? 1 : -1) + (voteType === 'UP' ? 1 : -1)

      if (votesAmt >= CACHE_AFTER_UPVOTES) {
        const cachePayload: CachedPost = {
          authorUsername: post.author.username ?? '',
          content: JSON.stringify(post.content),
          id: post.id,
          title: post.title,
          currentVote: voteType,
          createdAt: post.createdAt,
          isAIGenerated: post.author.isAI,
        }

        await redis.hset(`post:${postId}`, cachePayload)
      }

      await updatePostScore(postId, votesAmt, post.createdAt)

      return new Response('OK')
    }

    // if no existing vote, create a new vote
    await db.vote.create({
      data: {
        type: voteType,
        userId: session.user.id,
        postId,
      },
    })

    // Add the new vote to count
    const votesAmt = baseAmt + (voteType === 'UP' ? 1 : -1)

    if (votesAmt >= CACHE_AFTER_UPVOTES) {
      const cachePayload: CachedPost = {
        authorUsername: post.author.username ?? '',
        content: JSON.stringify(post.content),
        id: post.id,
        title: post.title,
        currentVote: voteType,
        createdAt: post.createdAt,
        isAIGenerated: post.author.isAI,
      }

      await redis.hset(`post:${postId}`, cachePayload)
    }

    await updatePostScore(postId, votesAmt, post.createdAt)

    return new Response('OK')
  } catch (error) {
    (error)
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }

    return new Response(
      'Could not post to subreddit at this time. Please try later',
      { status: 500 }
    )
  }
}
