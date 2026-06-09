import CommentsSection from '@/components/CommentsSection'
import EditorOutput from '@/components/EditorOutput'
import PostVoteServer from '@/components/post-vote/PostVoteServer'
import { AIBadge } from '@/components/AIBadge'
import { InlineMathProcessor } from '@/components/InlineMathProcessor'
import { RelatedPosts } from '@/components/RelatedPosts'
import { buttonVariants } from '@/components/ui/Button'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { formatTimeToNow } from '@/lib/utils'
import { CachedPost } from '@/types/redis'
import { Post, User, Vote } from '@prisma/client'
import { ArrowBigDown, ArrowBigUp, Loader2 } from 'lucide-react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
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
      authorId: true,
      subredditId: true,
    },
  })

  if (!post) return { title: 'Post Not Found — Nexus Hub' }

  // Resolve author and subreddit manually (compatible with Supabase REST)
  let authorLabel = 'Unknown'
  let subName = 'Nexus'
  try {
    const author = await db.user.findFirst({
      where: { id: (post as any).authorId },
      select: { username: true, isAI: true, aiRole: true },
    })
    if (author) {
      authorLabel = (author as any).isAI
        ? `AI-${(author as any).aiRole || '生成'}`
        : `u/${(author as any).username}`
    }
    const sub = await db.subreddit.findFirst({
      where: { id: (post as any).subredditId },
      select: { name: true },
    })
    if (sub) subName = (sub as any).name
  } catch { /* fallback */ }

  // 从 EditorJS JSON 中提取纯文本描述
  let description = ''
  try {
    const content = (post as any).content
    if (content) {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      const firstParagraph = parsed?.blocks?.find(
        (b: any) => b.data?.text && b.data.text.length > 30
      )
      description =
        firstParagraph?.data?.text?.replace(/<[^>]+>/g, '').substring(0, 160) ||
        ''
    }
  } catch {
    description = (post as any).title
  }

  return {
    title: `${(post as any).title} — r/${subName} | Nexus Hub`,
    description: `${authorLabel} · ${description}`,
    openGraph: {
      title: (post as any).title,
      description: `${authorLabel} · ${description}`,
      type: 'article',
      publishedTime: undefined,
      authors: [authorLabel],
    },
    twitter: {
      card: 'summary',
      title: (post as any).title,
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
            Posted by{' '}
            <Link
              href={`/u/${post?.author.username ?? cachedPost?.authorUsername}`}
              className='underline hover:text-orange-500'>
              u/{post?.author.username ?? cachedPost?.authorUsername}
            </Link>{' '}
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

          <Suspense fallback={<Loader2 className='h-5 w-5 animate-spin text-zinc-500 mt-8' />}>
            <RelatedPostsWrapper
              currentPostId={post?.id ?? cachedPost?.id ?? params.postId}
              subredditName={params.slug}
            />
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

async function RelatedPostsWrapper({
  currentPostId,
  subredditName,
}: {
  currentPostId: string
  subredditName: string
}) {
  try {
    // Get subreddit ID
    const sub = await db.subreddit.findFirst({
      where: { name: subredditName },
      select: { id: true },
    })
    if (!sub) return null
    const subredditId = (sub as any).id

    // Get current post embedding
    let embedding: number[] | null = null
    try {
      const currentPost = await db.post.findFirst({
        where: { id: currentPostId },
        select: { embedding: true },
      })
      if (currentPost) {
        const emb = (currentPost as any).embedding
        if (typeof emb === 'string') {
          embedding = JSON.parse(emb)
        } else if (Array.isArray(emb)) {
          embedding = emb
        }
      }
    } catch {
      // embedding lookup failed
    }

    return (
      <RelatedPosts
        currentPostId={currentPostId}
        subredditId={subredditId}
        subredditName={subredditName}
        embedding={embedding}
      />
    )
  } catch {
    return null
  }
}

export default SubRedditPostPage
