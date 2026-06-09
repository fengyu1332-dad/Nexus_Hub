import { INFINITE_SCROLL_PAGINATION_RESULTS } from '@/config'
import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import PostFeed from '../PostFeed'
import { notFound } from 'next/navigation'

const CustomFeed = async ({ sort }: { sort?: string }) => {
  const session = await getAuthSession()

  // only rendered if session exists, so this will not happen
  if (!session) return notFound()

  const followedCommunities = await db.subscription.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      subreddit: true,
    },
  })

  let orderBy: Record<string, string>
  if (sort === 'hot') {
    orderBy = { hotScore: 'desc' }
  } else if (sort === 'top') {
    orderBy = { voteCount: 'desc' }
  } else {
    orderBy = { createdAt: 'desc' }
  }

  const posts = await db.post.findMany({
    where: {
      subreddit: {
        name: {
          in: followedCommunities.map((sub) => sub.subreddit.name),
        },
      },
    },
    orderBy,
    include: {
      votes: true,
      author: true,
      comments: true,
      subreddit: true,
    },
    take: INFINITE_SCROLL_PAGINATION_RESULTS,
  })

  // Fetch bookmarks for current user
  let savedPostIds: Set<string> | undefined
  try {
    const bookmarks = await db.bookmark.findMany({
      where: { userId: session.user.id },
      select: { postId: true },
    })
    savedPostIds = new Set(bookmarks.map((b: any) => b.postId))
  } catch {
    // Bookmark table may not exist yet
  }

  return <PostFeed initialPosts={posts} sort={sort} savedPostIds={savedPostIds} />
}

export default CustomFeed
