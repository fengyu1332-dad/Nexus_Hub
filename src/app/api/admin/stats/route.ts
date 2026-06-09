import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const [totalUsers, totalPosts, totalComments, totalCommunities] =
      await Promise.all([
        db.user.count({ where: {} }),
        db.post.count({ where: {} }),
        db.comment.count({ where: {} }),
        db.subreddit.count({ where: {} }),
      ])

    return new Response(
      JSON.stringify({
        totalUsers,
        totalPosts,
        totalComments,
        totalCommunities,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[admin-stats] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not fetch stats', { status: 500 })
  }
}
