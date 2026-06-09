import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminStatsCards } from '@/components/admin/AdminStatsCards'
import { getDictionary } from '@/i18n'

export default async function AdminDashboard() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  const [totalUsers, totalPosts, totalComments, totalCommunities] =
    await Promise.all([
      db.user.count({ where: {} }),
      db.post.count({ where: {} }),
      db.comment.count({ where: {} }),
      db.subreddit.count({ where: {} }),
    ])

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.dashboard}</h1>
      <AdminStatsCards
        stats={{ totalUsers, totalPosts, totalComments, totalCommunities }}
      />
    </div>
  )
}
