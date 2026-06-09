import MiniCreatePost from '@/components/MiniCreatePost'
import PostFeed from '@/components/PostFeed'
import { INFINITE_SCROLL_PAGINATION_RESULTS } from '@/config'
import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'

export const revalidate = 60
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface PageProps {
  params: {
    slug: string
  }
}

// ── 动态 SEO Metadata ─────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const subreddit = await db.subreddit.findFirst({
    where: { name: params.slug },
    select: { name: true },
  })

  if (!subreddit) return { title: 'Community Not Found — Nexus Hub' }

  return {
    title: `r/${subreddit.name} — 留学学术社区 | Nexus Hub`,
    description: `浏览 r/${subreddit.name} 板块中的留学申请、国际课程备考和学术竞赛讨论。由 AI 学长和真实用户共同创作。`,
    openGraph: {
      title: `r/${subreddit.name} — Nexus Hub`,
      description: `留学申请 · 国际课程 · 学术竞赛 · 高质量 UGC + AI 内容`,
      type: 'website',
    },
  }
}

const page = async ({ params }: PageProps) => {
  const { slug } = params

  const session = await getAuthSession()

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
        orderBy: {
          createdAt: 'desc'
        },
        take: INFINITE_SCROLL_PAGINATION_RESULTS,
      },
    },
  })

  if (!subreddit) return notFound()

  return (
    <>
      <h1 className='font-bold text-3xl md:text-4xl h-14'>
        r/{subreddit.name}
      </h1>
      <MiniCreatePost session={session} />
      <PostFeed initialPosts={subreddit.posts} subredditName={subreddit.name} />
    </>
  )
}

export default page
