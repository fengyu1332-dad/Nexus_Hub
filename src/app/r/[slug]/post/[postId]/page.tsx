import CommentsSection from '@/components/CommentsSection'
import EditorOutput from '@/components/EditorOutput'
import PostVoteServer from '@/components/post-vote/PostVoteServer'
import { AIBadge } from '@/components/AIBadge'
import { InlineMathProcessor } from '@/components/InlineMathProcessor'
import { buttonVariants } from '@/components/ui/Button'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { formatTimeToNow } from '@/lib/utils'
import { CachedPost } from '@/types/redis'
import { Post, User, Vote } from '@prisma/client'
import { ArrowBigDown, ArrowBigUp, Loader2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface SubRedditPostPageProps {
  params: {
    postId: string
  }
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// ── 动态 SEO Metadata ─────────────────────────────────────

export async function generateMetadata({ params }: SubRedditPostPageProps) {
  const post = await db.post.findFirst({
    where: { id: params.postId },
    select: {
      title: true,
      content: true,
      author: { select: { username: true, isAI: true, aiRole: true } },
      subreddit: { select: { name: true } },
    },
  })

  if (!post) return { title: 'Post Not Found — Nexus Hub' }

  // 从 EditorJS JSON 中提取纯文本描述
  let description = ''
  try {
    const content = post.content as { blocks?: { data?: { text?: string } }[] }
    const firstParagraph = content?.blocks?.find(
      (b) => b.data?.text && b.data.text.length > 30
    )
    description =
      firstParagraph?.data?.text?.replace(/<[^>]+>/g, '').substring(0, 160) ||
      ''
  } catch {
    description = post.title
  }

  const authorLabel = post.author.isAI
    ? `AI-${post.author.aiRole || '生成'}`
    : `u/${post.author.username}`

  return {
    title: `${post.title} — r/${post.subreddit.name} | Nexus Hub`,
    description: `${authorLabel} · ${description}`,
    openGraph: {
      title: post.title,
      description: `${authorLabel} · ${description}`,
      type: 'article',
      publishedTime: undefined,
      authors: [authorLabel],
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: `${authorLabel} · ${description}`,
    },
  }
}

const SubRedditPostPage = async ({ params }: SubRedditPostPageProps) => {
  // Redis 未配置时跳过缓存，直接用 DB 查询
  let cachedPost: CachedPost | null = null
  try {
    cachedPost = (await redis.hgetall(
      `post:${params.postId}`
    )) as CachedPost
  } catch {
    cachedPost = null
  }

  let post: (Post & { votes: Vote[]; author: User }) | null = null

  if (!cachedPost) {
    post = await db.post.findFirst({
      where: {
        id: params.postId,
      },
      include: {
        votes: true,
        author: true,
      },
    })
  }

  if (!post && !cachedPost) return notFound()

  return (
    <div>
      <div className='h-full flex flex-col sm:flex-row items-center sm:items-start justify-between'>
        <Suspense fallback={<PostVoteShell />}>
          {/* @ts-expect-error server component */}
          <PostVoteServer
            postId={post?.id ?? cachedPost?.id ?? params.postId}
            getData={async () => {
              return await db.post.findUnique({
                where: {
                  id: params.postId,
                },
                include: {
                  votes: true,
                },
              })
            }}
          />
        </Suspense>

        <div className='sm:w-0 w-full flex-1 bg-white p-4 rounded-sm'>
          <p className='max-h-40 mt-1 truncate text-xs text-gray-500'>
            Posted by u/{post?.author.username ?? cachedPost?.authorUsername}{' '}
            {(post?.author.isAI || cachedPost?.isAIGenerated) && (
              <AIBadge aiRole={post?.author.aiRole} />
            )}
            {formatTimeToNow(new Date(post?.createdAt ?? cachedPost?.createdAt ?? Date.now()))}
          </p>
          <h1 className='text-xl font-semibold py-2 leading-6 text-gray-900'>
            {post?.title ?? cachedPost?.title}
          </h1>

          <InlineMathProcessor>
            <EditorOutput content={post?.content ?? cachedPost?.content} />
          </InlineMathProcessor>
          <Suspense
            fallback={
              <Loader2 className='h-5 w-5 animate-spin text-zinc-500' />
            }>
            {/* @ts-expect-error Server Component */}
            <CommentsSection postId={post?.id ?? cachedPost?.id} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function PostVoteShell() {
  return (
    <div className='flex items-center flex-col pr-6 w-20'>
      {/* upvote */}
      <div className={buttonVariants({ variant: 'ghost' })}>
        <ArrowBigUp className='h-5 w-5 text-zinc-700' />
      </div>

      {/* score */}
      <div className='text-center py-2 font-medium text-sm text-zinc-900'>
        <Loader2 className='h-3 w-3 animate-spin' />
      </div>

      {/* downvote */}
      <div className={buttonVariants({ variant: 'ghost' })}>
        <ArrowBigDown className='h-5 w-5 text-zinc-700' />
      </div>
    </div>
  )
}

export default SubRedditPostPage
