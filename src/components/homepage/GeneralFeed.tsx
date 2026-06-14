import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import PostFeed from '../PostFeed'
import { INFINITE_SCROLL_PAGINATION_RESULTS } from '@/config'

const GeneralFeed = async ({ sort }: { sort?: string }) => {
  // Fetch session and subscriptions
  let session = null
  let subscribedIds: string[] = []
  try {
    session = await getAuthSession()
  } catch {
    // getAuthSession may fail during SSR on Vercel
  }

  if (session?.user) {
    try {
      const subs = await db.subscription.findMany({
        where: { userId: session.user.id },
        select: { subredditId: true },
      })
      subscribedIds = subs.map((s: any) => s.subredditId)
    } catch {
      // Subscription table may not be ready
    }
  }

  let orderBy: Record<string, string>
  if (sort === 'hot') {
    orderBy = { hotScore: 'desc' }
  } else if (sort === 'top') {
    orderBy = { voteCount: 'desc' }
  } else if (sort === 'new') {
    orderBy = { createdAt: 'desc' }
  } else {
    // Default: sort by hotScore for better discovery
    orderBy = { hotScore: 'desc' }
  }

  // Fetch subscribed posts first if user has subscriptions
  let subscribedPosts: any[] = []
  let generalPosts: any[] = []

  if (subscribedIds.length > 0) {
    try {
      subscribedPosts = await db.post.findMany({
        orderBy,
        where: { subreddit: { id: { in: subscribedIds } } },
        include: { votes: true, author: true, comments: true, subreddit: true },
        take: INFINITE_SCROLL_PAGINATION_RESULTS,
      })
    } catch {
      subscribedPosts = []
    }
  }

  // Fill remaining slots with general posts (deduplicated in memory)
  const remaining = INFINITE_SCROLL_PAGINATION_RESULTS - subscribedPosts.length
  if (remaining > 0) {
    try {
      const allPosts = await db.post.findMany({
        orderBy,
        include: { votes: true, author: true, comments: true, subreddit: true },
        take: INFINITE_SCROLL_PAGINATION_RESULTS + subscribedPosts.length,
      })
      const subscribedIds_set = new Set(subscribedPosts.map((p: any) => p.id))
      generalPosts = allPosts.filter((p: any) => !subscribedIds_set.has(p.id)).slice(0, remaining)
    } catch {
      generalPosts = []
    }
  }

  const posts = [...subscribedPosts, ...generalPosts]

  // Fetch bookmarks for current user
  let savedPostIds: string[] = []
  if (session?.user) {
    try {
      const bookmarks = await db.bookmark.findMany({
        where: { userId: session.user.id },
        select: { postId: true },
      })
      savedPostIds = bookmarks.map((b: any) => b.postId)
    } catch {
      // Bookmark table may not exist yet
    }
  }

  return <PostFeed initialPosts={posts} sort={sort || 'hot'} savedPostIds={savedPostIds} />
}

export default GeneralFeed
