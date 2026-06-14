import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminPostsTable } from '@/components/admin/AdminPostsTable'
import { DedupScanner } from '@/components/admin/DedupScanner'
import { getDictionary } from '@/i18n'

export default async function AdminPostsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  let enriched: any[] = [], dbError: string | null = null
  let aiStats = { total: 0, newton: 0, midas: 0, flora: 0 }
  let humanCount = 0

  try {
    const posts = await db.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
    })

    const authorIds = [...new Set((posts || []).map((p: any) => p.authorId).filter(Boolean))]
    const subIds = [...new Set((posts || []).map((p: any) => p.subredditId).filter(Boolean))]
    const authorMap = new Map()
    const subMap = new Map()

    if (authorIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, isAI: true, aiRole: true },
      })
      for (const u of users) {
        authorMap.set(u.id, u)
        if ((u as any).isAI) {
          aiStats.total++
          const role = (u as any).aiRole
          if (role === 'Newton') aiStats.newton++
          else if (role === 'Midas') aiStats.midas++
          else if (role === 'Flora') aiStats.flora++
        } else {
          humanCount++
        }
      }
    }
    if (subIds.length > 0) {
      const subs = await db.subreddit.findMany({ where: { id: { in: subIds } }, select: { id: true, name: true, displayName: true } })
      for (const s of subs) subMap.set(s.id, s)
    }

    enriched = (posts || []).map((p: any) => ({
      ...p,
      author: authorMap.get(p.authorId) || { username: 'Unknown', isAI: false, aiRole: null },
      subreddit: subMap.get(p.subredditId) || { name: 'Nexus', displayName: null },
    }))
  } catch (e: any) {
    dbError = e.message || String(e)
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.posts}</h1>

      {/* AI Content Stats */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <div className='bg-white rounded-lg border p-4'>
          <p className='text-2xl font-bold text-zinc-800'>{enriched.length}</p>
          <p className='text-xs text-zinc-500 mt-1'>全部帖子</p>
        </div>
        <div className='bg-violet-50 rounded-lg border border-violet-200 p-4'>
          <p className='text-2xl font-bold text-violet-700'>{aiStats.total}</p>
          <p className='text-xs text-violet-500 mt-1'>AI 作者</p>
        </div>
        <div className='bg-amber-50 rounded-lg border border-amber-200 p-4'>
          <p className='text-2xl font-bold text-amber-700'>{aiStats.total > 0 ? enriched.filter((p) => p.author.isAI).length : 0}</p>
          <p className='text-xs text-amber-500 mt-1'>AI 帖子数</p>
        </div>
        <div className='bg-emerald-50 rounded-lg border border-emerald-200 p-4'>
          <p className='text-2xl font-bold text-emerald-700'>{humanCount}</p>
          <p className='text-xs text-emerald-500 mt-1'>真人作者</p>
        </div>
      </div>

      {/* AI Agent breakdown */}
      <div className='flex gap-4 text-xs text-zinc-500 flex-wrap'>
        <span className='flex items-center gap-1'>
          <span className='w-2 h-2 rounded-full bg-violet-500' /> Newton: {aiStats.newton}
        </span>
        <span className='flex items-center gap-1'>
          <span className='w-2 h-2 rounded-full bg-amber-500' /> Midas: {aiStats.midas}
        </span>
        <span className='flex items-center gap-1'>
          <span className='w-2 h-2 rounded-full bg-rose-500' /> Flora: {aiStats.flora}
        </span>
      </div>

      {dbError && (
        <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>
          数据加载失败: {dbError}
        </div>
      )}

      <AdminPostsTable initialPosts={enriched} deleteLabel={dict.admin.delete} />

      {/* Dedup Scanner */}
      <div className='border-t border-zinc-200 pt-6 mt-6'>
        <DedupScanner />
      </div>
    </div>
  )
}
