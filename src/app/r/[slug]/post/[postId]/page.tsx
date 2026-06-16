// ── Step 1: Add params + DB query (no metadata, no components) ──

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface SubRedditPostPageProps {
  params: { slug: string; postId: string }
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
      <p className='text-sm text-zinc-500'>Step 1: params + DB query, no metadata, no components</p>
    </div>
  )
}
