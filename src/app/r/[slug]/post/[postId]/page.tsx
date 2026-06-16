// ── Step 2c: DB query in generateMetadata (no getDictionary) ──

import { db } from '@/lib/db'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface SubRedditPostPageProps {
  params: { slug: string; postId: string }
}

export async function generateMetadata({ params }: SubRedditPostPageProps): Promise<Metadata> {
  let title = `Post ${params.postId} | Nexus Hub`
  try {
    const post = await db.post.findFirst({
      where: { id: params.postId },
      select: { title: true },
    })
    if (post) title = `${(post as any).title} | Nexus Hub`
  } catch { /* DB error */ }
  return {
    title,
    description: 'Step 2c: DB query in generateMetadata',
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
