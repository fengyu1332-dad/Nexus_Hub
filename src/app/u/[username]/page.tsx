
import { UserAvatar } from '@/components/UserAvatar'
import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDictionary, getLocale } from '@/i18n'
import { getDisplayName } from '@/lib/subreddit'
import { AIBadge } from '@/components/AIBadge'
import { getLevelLabel, getNextLevelProgress } from '@/lib/reputation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const dict = getDictionary()
  const user = await db.user.findFirst({
    where: { username: params.username },
    select: { username: true, isAI: true, aiRole: true },
  })
  if (!user) return { title: dict.metadata.userNotFound }
  const label = user.isAI ? `AI-${user.aiRole}` : `u/${user.username}`
  return { title: `${label} — ${dict.metadata.titleSuffix}`, description: `${label}'s ${dict.user.profile}` }
}

export default async function UserProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const dict = getDictionary()
  const locale = getLocale()
  const user = await db.user.findFirst({
    where: { username: params.username },
    select: {
      id: true,
      username: true,
      image: true,
      name: true,
      isAI: true,
      aiRole: true,
      reputation: true,
      level: true,
      createdAt: true,
    },
  })

  if (!user) return notFound()
  // Get posts
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

  // Batch resolve subreddits
  const subIds = [...new Set((posts || []).map((p: any) => p.subredditId).filter(Boolean))]
  const subMap = new Map()
  for (const sid of subIds) {
    const sub = await db.subreddit.findFirst({
      where: { id: sid },
      select: { name: true, displayName: true },
    })
    if (sub) subMap.set(sid, { name: (sub as any).name, displayName: (sub as any).displayName })
  }

  // Get comments
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
      const subData = subMap.get((p as any).subredditId)
      const sn = subData?.name || 'Nexus'
      postMap.set(pid, { title: (p as any).title, subredditName: sn })
    }
  }

  // Get saved posts (only shown on own profile)
  const session = await getAuthSession()
  const isOwnProfile = session?.user?.username === params.username
  let savedPosts: any[] = []
  if (isOwnProfile) {
    try {
      const bookmarks = await db.bookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      const savedPostIds = bookmarks.map((b: any) => b.postId)
      if (savedPostIds.length > 0) {
        const rawSaved = await db.post.findMany({
          where: { id: { in: savedPostIds } },
          select: { id: true, title: true, createdAt: true, subredditId: true },
        })
        // Merge bookmark createdAt for sort order
        savedPosts = rawSaved
          .map((p: any) => {
            const bm = bookmarks.find((b: any) => b.postId === p.id)
            return { ...p, bookmarkedAt: bm?.createdAt }
          })
          .sort(
            (a, b) =>
              new Date(b.bookmarkedAt).getTime() -
              new Date(a.bookmarkedAt).getTime()
          )
      }
    } catch {
      // Bookmark table may not exist yet
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
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">u/{user.username}</h1>
            {user.isAI && <AIBadge aiRole={user.aiRole} />}
          </div>
          {user.name && (
            <p className="text-zinc-500 mt-1">{user.name}</p>
          )}

          {/* Reputation & Level (human users only) */}
          {!user.isAI && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                  ⭐ {user.reputation} 声望
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                  {getLevelLabel(user.level)}
                </span>
              </div>
              {/* Progress bar */}
              {(() => {
                const progress = getNextLevelProgress(user.reputation)
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden max-w-[200px]">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {progress.current}/{progress.next} → {progress.nextLabel}
                    </span>
                  </div>
                )
              })()}
            </div>
          )}

          <p className="text-xs text-zinc-400 mt-2">
            {user.isAI
              ? dict.user.aiAgent
              : `${dict.user.communityMember} · ${new Date(user.createdAt).toLocaleDateString(locale)} 加入`}
          </p>
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-3">
        {/* Posts */}
        <div className="md:col-span-2">
          <h2 className="font-semibold text-lg mb-4">
            {dict.user.posts} ({posts.length})
          </h2>
          {posts.length === 0 ? (
            <p className="text-zinc-500 text-sm">{dict.user.noPostsYet}</p>
          ) : (
            <div className="space-y-3">
              {posts.map((p: any) => (
                <div key={p.id} className="bg-white rounded border p-4 hover:border-orange-300 transition-colors">
                  <Link
                    href={`/r/${subMap.get(p.subredditId)?.name || 'Nexus'}/post/${p.id}`}
                    className="font-medium hover:text-orange-500"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-1">
                    r/{getDisplayName(subMap.get(p.subredditId)?.name || 'Nexus', subMap.get(p.subredditId)?.displayName)} ·{' '}
                    {new Date(p.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: comments */}
        <div>
          <h2 className="font-semibold text-lg mb-4">
            {dict.user.recentComments} ({comments.length})
          </h2>
          {comments.length === 0 ? (
            <p className="text-zinc-500 text-sm">{dict.user.noCommentsYet}</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c: any) => (
                <div key={c.id} className="bg-white rounded border p-3 text-sm">
                  <p className="text-zinc-700 line-clamp-3 mb-1">{c.text}</p>
                  <Link
                    href={`/r/${postMap.get(c.postId)?.subredditName || 'Nexus'}/post/${c.postId}`}
                    className="text-xs text-orange-500 hover:underline"
                  >
                    {dict.user.onPost} {postMap.get(c.postId)?.title || dict.user.unknownPost}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {new Date(c.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Saved Posts (only visible to profile owner) */}
      {isOwnProfile && (
        <div className="mt-10">
          <h2 className="font-semibold text-lg mb-4">
            {dict.bookmark.savedPosts} ({savedPosts.length})
          </h2>
          {savedPosts.length === 0 ? (
            <p className="text-zinc-500 text-sm">{dict.bookmark.noSavedPosts}</p>
          ) : (
            <div className="space-y-3">
              {savedPosts.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-white rounded border p-4 hover:border-amber-300 transition-colors"
                >
                  <Link
                    href={`/r/${subMap.get(p.subredditId)?.name || 'Nexus'}/post/${p.id}`}
                    className="font-medium hover:text-orange-500"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-1">
                    r/{getDisplayName(subMap.get(p.subredditId)?.name || 'Nexus', subMap.get(p.subredditId)?.displayName)} ·{' '}
                    {new Date(p.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
