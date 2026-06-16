// ── Step 2b: Add getDictionary() back ──

import { db } from '@/lib/db'
import { getDictionary } from '@/i18n'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface SubRedditPostPageProps {
  params: { slug: string; postId: string }
}

export async function generateMetadata({ params }: SubRedditPostPageProps): Promise<Metadata> {
  const dict = getDictionary()
  return {
    title: `Post ${params.postId} | ${dict.metadata.titleSuffix}`,
    description: 'Step 2b: getDictionary() added',
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
      <p className='text-sm text-zinc-500'>Step 2a: static metadata (no DB, no getDictionary, no getDisplayName)</p>
    </div>
  )
}
