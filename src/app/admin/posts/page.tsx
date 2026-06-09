import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminPostsTable } from '@/components/admin/AdminPostsTable'
import { getDictionary } from '@/i18n'

export default async function AdminPostsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  const posts = await db.post.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      createdAt: true,
      authorId: true,
      subredditId: true,
    },
  })

  // Batch-resolve authors and subreddits
  const authorIds = [...new Set((posts || []).map((p: any) => p.authorId).filter(Boolean))]
  const subIds = [...new Set((posts || []).map((p: any) => p.subredditId).filter(Boolean))]
  const authorMap = new Map()
  const subMap = new Map()

  for (const id of authorIds) {
    const u = await db.user.findFirst({ where: { id }, select: { id: true, username: true } })
    if (u) authorMap.set(id, u)
  }
  for (const id of subIds) {
    const s = await db.subreddit.findFirst({ where: { id }, select: { id: true, name: true } })
    if (s) subMap.set(id, s)
  }

  const enriched = (posts || []).map((p: any) => ({
    ...p,
    author: authorMap.get(p.authorId) || { username: 'Unknown' },
    subreddit: subMap.get(p.subredditId) || { name: 'Nexus' },
  }))

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.posts}</h1>
      <AdminPostsTable initialPosts={enriched} deleteLabel={dict.admin.delete} />
    </div>
  )
}
