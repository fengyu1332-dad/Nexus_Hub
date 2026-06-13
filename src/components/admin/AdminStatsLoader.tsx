import { db } from '@/lib/db'
import { AdminStatsCards } from '@/components/admin/AdminStatsCards'
import { getDictionary } from '@/i18n'

export async function AdminStatsLoader() {
  const dict = getDictionary()

  let totalUsers = 0, totalPosts = 0, totalComments = 0, totalCommunities = 0

  try {
    ;[totalUsers, totalPosts, totalComments, totalCommunities] =
      await Promise.all([
        db.user.count(),
        db.post.count(),
        db.comment.count(),
        db.subreddit.count(),
      ])
  } catch (e: any) {
    // Swallow — cards will show 0
    console.error('[AdminStatsLoader] count error:', e.message || String(e))
  }

  return (
    <AdminStatsCards
      stats={{ totalUsers, totalPosts, totalComments, totalCommunities }}
      labels={{
        totalUsers: dict.admin.totalUsers,
        totalPosts: dict.admin.totalPosts,
        totalComments: dict.admin.totalComments,
        totalCommunities: dict.admin.totalCommunities,
      }}
    />
  )
}
