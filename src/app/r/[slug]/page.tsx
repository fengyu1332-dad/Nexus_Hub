import MiniCreatePost from '@/components/MiniCreatePost'
import PostFeed from '@/components/PostFeed'
import SortSelector from '@/components/SortSelector'
import { INFINITE_SCROLL_PAGINATION_RESULTS } from '@/config'
import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const revalidate = 60
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDictionary } from '@/i18n'

interface PageProps {
  params: {
    slug: string
  }
  searchParams: { sort?: string }
}

// ── Dynamic SEO Metadata ─────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const dict = getDictionary()
  const subreddit = await db.subreddit.findFirst({
    where: { name: params.slug },
    select: { name: true },
  })

  if (!subreddit) return { title: dict.metadata.communityNotFound }

  return {
    title: `r/${subreddit.name} — ${dict.metadata.titleSuffix}`,
    description: `r/${subreddit.name}`,
  }
}

const page = async ({ params, searchParams }: PageProps) => {
  const { slug } = params
  const sort = searchParams.sort || 'new'

  let session = null
  try {
    session = await getAuthSession()
  } catch {
    // getAuthSession may fail during SSR on Vercel
  }

  let orderBy: Record<string, string>
  if (sort === 'hot') {
    orderBy = { hotScore: 'desc' }
  } else if (sort === 'top') {
    orderBy = { voteCount: 'desc' }
  } else {
    orderBy = { createdAt: 'desc' }
  }

  const subreddit = await db.subreddit.findFirst({
    where: { name: slug },
    include: {
      posts: {
        include: {
          author: true,
          votes: true,
          comments: true,
          subreddit: true,
        },
        orderBy,
        take: INFINITE_SCROLL_PAGINATION_RESULTS,
      },
    },
  })

  if (!subreddit) return notFound()

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

  return (
    <>
      <h1 className='font-bold text-3xl md:text-4xl h-14'>
        r/{subreddit.name}
      </h1>
      <div className='mb-4'>
        <SortSelector />
      </div>
      <MiniCreatePost session={session} />
      <PostFeed
        initialPosts={subreddit.posts}
        subredditName={subreddit.name}
        sort={sort}
        savedPostIds={savedPostIds}
      />
    </>
  )
}

export default page
