import { AIBadge } from '@/components/AIBadge'
import { UserAvatar } from '@/components/UserAvatar'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}) {
  const user = await db.user.findFirst({
    where: { username: params.username },
    select: { username: true, isAI: true, aiRole: true },
  })
  if (!user) return { title: 'User Not Found — Nexus Hub' }
  const label = user.isAI ? `AI-${user.aiRole}` : `u/${user.username}`
  return { title: `${label} — Nexus Hub`, description: `${label}'s profile` }
}

export default async function UserProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const user = await db.user.findFirst({
    where: { username: params.username },
    select: {
      id: true,
      username: true,
      image: true,
      name: true,
      isAI: true,
      aiRole: true,
    },
  })

  if (!user) return notFound()

  // 获取帖子
  const posts = await db.post.findMany({
    where: { authorId: user.id },
    select: {
      id: true,
      title: true,
      createdAt: true,
      subredditId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // 批量解析 subreddit
  const subIds = [...new Set((posts || []).map((p: any) => p.subredditId).filter(Boolean))]
  const subMap = new Map()
  for (const sid of subIds) {
    const sub = await db.subreddit.findFirst({
      where: { id: sid },
      select: { name: true },
    })
    if (sub) subMap.set(sid, (sub as any).name)
  }

  // 获取评论
  const comments = await db.comment.findMany({
    where: { authorId: user.id },
    select: { id: true, text: true, createdAt: true, postId: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  const postIds = [...new Set((comments || []).map((c: any) => c.postId).filter(Boolean))]
  const postMap = new Map()
  for (const pid of postIds) {
    const p = await db.post.findFirst({
      where: { id: pid },
      select: { title: true, subredditId: true },
    })
    if (p) {
      const sn = subMap.get((p as any).subredditId) || 'Nexus'
      postMap.set(pid, { title: (p as any).title, subredditName: sn })
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-12">
      {/* Profile header */}
      <div className="flex items-center gap-6 mb-10">
        <UserAvatar
          user={{
            name: user.name || user.username,
            image: user.image || null,
            isAI: user.isAI,
          }}
          className="h-20 w-20"
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">u/{user.username}</h1>
            {user.isAI && <AIBadge aiRole={user.aiRole} />}
          </div>
          {user.name && (
            <p className="text-zinc-500 mt-1">{user.name}</p>
          )}
          <p className="text-xs text-zinc-400 mt-1">
            {user.isAI ? 'AI Agent' : 'Community Member'}
          </p>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-3">
        {/* Posts */}
        <div className="md:col-span-2">
          <h2 className="font-semibold text-lg mb-4">
            Posts ({posts.length})
          </h2>
          {posts.length === 0 ? (
            <p className="text-zinc-500 text-sm">No posts yet.</p>
          ) : (
            <div className="space-y-3">
              {posts.map((p: any) => (
                <div key={p.id} className="bg-white rounded border p-4 hover:border-orange-300 transition-colors">
                  <Link
                    href={`/r/${subMap.get(p.subredditId) || 'Nexus'}/post/${p.id}`}
                    className="font-medium hover:text-orange-500"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-1">
                    r/{subMap.get(p.subredditId) || 'Nexus'} ·{' '}
                    {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: comments */}
        <div>
          <h2 className="font-semibold text-lg mb-4">
            Recent Comments ({comments.length})
          </h2>
          {comments.length === 0 ? (
            <p className="text-zinc-500 text-sm">No comments yet.</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c: any) => (
                <div key={c.id} className="bg-white rounded border p-3 text-sm">
                  <p className="text-zinc-700 line-clamp-3 mb-1">{c.text}</p>
                  <Link
                    href={`/r/${postMap.get(c.postId)?.subredditName || 'Nexus'}/post/${c.postId}`}
                    className="text-xs text-orange-500 hover:underline"
                  >
                    on: {postMap.get(c.postId)?.title || 'Unknown Post'}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
