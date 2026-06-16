import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { getDisplayName } from '@/lib/subreddit'
import { getDictionary } from '@/i18n'
import type { Metadata } from 'next'

interface SubRedditPostPageProps {
  params: {
    slug: string
    postId: string
  }
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function generateMetadata({ params }: SubRedditPostPageProps): Promise<Metadata> {
  const dict = getDictionary()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub.vercel.app'
  const post = await db.post.findFirst({
    where: { id: params.postId },
    select: {
      title: true,
      content: true,
      createdAt: true,
      authorId: true,
      subredditId: true,
    },
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

  let description = ''
  try {
    const content = (post as any).content
    if (content) {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      const firstParagraph = parsed?.blocks?.find(
        (b: any) => b.data?.text && b.data.text.length > 30
      )
      description = firstParagraph?.data?.text?.replace(/<[^>]+>/g, '').substring(0, 160) || ''
    }
  } catch { description = (post as any).title }

  const postUrl = `${baseUrl}/r/${params.slug}/post/${params.postId}`
  const ogImage = `${baseUrl}/og.png`

  return {
    title: `${(post as any).title} — ${subName} | ${dict.metadata.titleSuffix}`,
    description: `${authorLabel} · ${description}`,
    alternates: { canonical: postUrl },
    openGraph: {
      title: (post as any).title,
      description: `${authorLabel} · ${description}`,
      type: 'article',
      publishedTime: (post as any).createdAt?.toISOString(),
      modifiedTime: (post as any).createdAt?.toISOString(),
      authors: [authorLabel],
      url: postUrl,
      images: [ogImage],
      siteName: dict.metadata.siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title: (post as any).title,
      description: `${authorLabel} · ${description}`,
      images: [ogImage],
    },
  }
}

// ── MINIMAL page for debugging client crash ──────────────

const SubRedditPostPage = async ({ params }: SubRedditPostPageProps) => {
  const dict = getDictionary()
  let post: any = null

  try {
    post = await db.post.findFirst({
      where: { id: params.postId },
      include: { votes: true, author: true },
    })
  } catch { /* db error */ }

  if (!post) return notFound()

  return (
    <div>
      <h1 className='text-xl font-semibold py-2 leading-6 text-gray-900'>
        {post.title}
      </h1>
      <p>DEBUG: Minimal post page — testing for crash.</p>
    </div>
  )
}

export default SubRedditPostPage
