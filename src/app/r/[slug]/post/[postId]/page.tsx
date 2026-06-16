// ── Step 2: Add generateMetadata back ──

import { db } from '@/lib/db'
import { getDisplayName } from '@/lib/subreddit'
import { getDictionary } from '@/i18n'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface SubRedditPostPageProps {
  params: { slug: string; postId: string }
}

export async function generateMetadata({ params }: SubRedditPostPageProps): Promise<Metadata> {
  const dict = getDictionary()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub.vercel.app'
  const post = await db.post.findFirst({
    where: { id: params.postId },
    select: { title: true, content: true, createdAt: true, authorId: true, subredditId: true },
  })

  if (!post) return { title: dict.metadata.postNotFound }

  let authorLabel = 'Unknown'
  let subName = 'Nexus'
  try {
    const author = await db.user.findFirst({
      where: { id: (post as any).authorId },
      select: { username: true, isAI: true, aiRole: true },
    })
    if (author) {
      authorLabel = (author as any).isAI
        ? `AI-${(author as any).aiRole || ''}`
        : `u/${(author as any).username || 'unknown'}`
    }
    const sub = await db.subreddit.findFirst({
      where: { id: (post as any).subredditId },
      select: { name: true, displayName: true },
    })
    if (sub) subName = getDisplayName((sub as any).name, (sub as any).displayName)
  } catch { /* fallback */ }

  return {
    title: `${(post as any).title} — ${subName} | ${dict.metadata.titleSuffix}`,
    description: authorLabel,
    alternates: { canonical: `${baseUrl}/r/${params.slug}/post/${params.postId}` },
    openGraph: {
      title: (post as any).title,
      description: authorLabel,
      type: 'article',
      publishedTime: (post as any).createdAt?.toISOString(),
      url: `${baseUrl}/r/${params.slug}/post/${params.postId}`,
      siteName: dict.metadata.siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title: (post as any).title,
      description: authorLabel,
    },
  }
}

export default async function SubRedditPostPage({ params }: SubRedditPostPageProps) {
  let post: any = null
  try {
    post = await db.post.findFirst({
      where: { id: params.postId },
    })
  } catch { /* db error */ }

  return (
    <div>
      <h1 className='text-xl font-semibold py-2'>
        DEBUG: {post?.title ?? 'Post not found'}
      </h1>
      <p className='text-sm text-zinc-500'>Step 2: generateMetadata added</p>
    </div>
  )
}
