import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import PostFeed from '../PostFeed'
import { INFINITE_SCROLL_PAGINATION_RESULTS } from '@/config'

const GeneralFeed = async ({ sort }: { sort?: string }) => {
  let orderBy: Record<string, string>
  if (sort === 'hot') {
    orderBy = { hotScore: 'desc' }
  } else if (sort === 'top') {
    orderBy = { voteCount: 'desc' }
  } else {
    orderBy = { createdAt: 'desc' }
  }

  const posts = await db.post.findMany({
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
  const session = await getAuthSession()
  let savedPostIds: Set<string> | undefined
  if (session?.user) {
    try {
      const bookmarks = await db.bookmark.findMany({
        where: { userId: session.user.id },
        select: { postId: true },
      })
      savedPostIds = new Set(bookmarks.map((b: any) => b.postId))
    } catch {
      // Bookmark table may not exist yet
    }
  }

  return <PostFeed initialPosts={posts} sort={sort} savedPostIds={savedPostIds} />
}

export default GeneralFeed
