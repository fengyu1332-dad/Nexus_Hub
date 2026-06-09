import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminStatsCards } from '@/components/admin/AdminStatsCards'
import { getDictionary } from '@/i18n'

export default async function AdminDashboard() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  let totalUsers = 0, totalPosts = 0, totalComments = 0, totalCommunities = 0
  let dbError: string | null = null

  try {
    ;[totalUsers, totalPosts, totalComments, totalCommunities] =
      await Promise.all([
        db.user.count({ where: {} }),
        db.post.count({ where: {} }),
        db.comment.count({ where: {} }),
        db.subreddit.count({ where: {} }),
      ])
  } catch (e: any) {
    dbError = e.message || String(e)
  }

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.dashboard}</h1>
      {dbError && (
        <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>
          数据加载失败: {dbError}
        </div>
      )}
      <AdminStatsCards
        stats={{ totalUsers, totalPosts, totalComments, totalCommunities }}
        labels={{
          totalUsers: dict.admin.totalUsers,
          totalPosts: dict.admin.totalPosts,
          totalComments: dict.admin.totalComments,
          totalCommunities: dict.admin.totalCommunities,
        }}
      />
    </div>
  )
}
