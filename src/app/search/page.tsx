import { db } from '@/lib/db'
import Link from 'next/link'
import { AIBadge } from '@/components/AIBadge'

export const dynamic = 'force-dynamic'

function extractTextFromContent(content: unknown): string {
  if (!content) return ''
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    const blocks = (parsed as any)?.blocks
    if (!Array.isArray(blocks)) return ''
    return blocks
      .map((b: any) => b.data?.text || '')
      .join(' ')
      .replace(/<[^>]+>/g, '')
  } catch {
    return typeof content === 'string' ? content : ''
  }
}

export async function generateMetadata({ searchParams }: { searchParams: { q?: string } }) {
  return {
    title: searchParams.q ? `Search: ${searchParams.q} — Nexus Hub` : 'Search — Nexus Hub',
    description: 'Search posts and communities on Nexus Hub',
  }
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  const q = searchParams.q || ''
  const keyword = q.toLowerCase()

  if (!q) {
    return (
      <div className='max-w-4xl mx-auto py-12'>
        <h1 className='font-bold text-3xl md:text-4xl mb-4'>Search</h1>
        <p className='text-zinc-500'>Enter a search term to find posts and communities.</p>
      </div>
    )
  }

  // Search communities
  let communities: any[] = []
  try {
    communities = await db.subreddit.findMany({
      where: { name: { startsWith: q } },
      include: { _count: true },
      take: 10,
    })
  } catch {
    communities = []
  }

  // Search posts
  let postResults: any[] = []
  try {
    const allPosts = await db.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
    })

    const matched = (allPosts || [])
      .filter((p: any) => {
        const title = (p.title || '').toLowerCase()
        const body = extractTextFromContent(p.content).toLowerCase()
        return title.includes(keyword) || body.includes(keyword)
      })
      .slice(0, 20)

    const authorIds = [...new Set(matched.map((p: any) => p.authorId).filter(Boolean))]
    const subIds = [...new Set(matched.map((p: any) => p.subredditId).filter(Boolean))]
    const authorMap = new Map()
    const subMap = new Map()
    for (const id of authorIds) {
      const u = await db.user.findFirst({ where: { id }, select: { username: true, isAI: true, aiRole: true } })
      if (u) authorMap.set(id, u)
    }
    for (const id of subIds) {
      const s = await db.subreddit.findFirst({ where: { id }, select: { name: true } })
      if (s) subMap.set(id, (s as any).name)
    }

    postResults = matched.map((p: any) => {
      const excerpt = extractTextFromContent(p.content).substring(0, 300)
      return {
        id: p.id,
        title: p.title,
        excerpt,
        createdAt: p.createdAt,
        author: authorMap.get(p.authorId) || { username: 'Unknown', isAI: false, aiRole: null },
        subredditName: subMap.get(p.subredditId) || 'Nexus',
      }
    })
  } catch {
    postResults = []
  }

  return (
    <div className='max-w-4xl mx-auto py-12'>
      <h1 className='font-bold text-3xl md:text-4xl mb-2'>Search</h1>
      <p className='text-zinc-500 mb-8'>
        Results for &quot;<span className='font-medium text-zinc-800'>{q}</span>&quot;
        — {postResults.length} posts, {communities.length} communities
      </p>

      {/* Communities */}
      {communities.length > 0 && (
        <section className='mb-10'>
          <h2 className='font-semibold text-lg mb-4'>Communities</h2>
          <div className='space-y-2'>
            {communities.map((c: any) => (
              <Link
                key={c.id}
                href={`/r/${c.name}`}
                className='block bg-white rounded border p-4 hover:border-orange-300 transition-colors'
              >
                <span className='font-medium'>r/{c.name}</span>
                {c._count?.subscribers !== undefined && (
                  <span className='text-xs text-zinc-400 ml-2'>
                    {c._count.subscribers} subscribers
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Posts */}
      <section>
        <h2 className='font-semibold text-lg mb-4'>Posts</h2>
        {postResults.length === 0 ? (
          <div className='bg-white rounded border p-8 text-center'>
            <p className='text-zinc-500'>No posts found for &quot;{q}&quot;</p>
            <p className='text-sm text-zinc-400 mt-1'>Try a different keyword</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {postResults.map((p: any) => (
              <div key={p.id} className='bg-white rounded border p-5 hover:border-orange-300 transition-colors'>
                <Link
                  href={`/r/${p.subredditName}/post/${p.id}`}
                  className='text-lg font-semibold hover:text-orange-500'
                >
                  {p.title}
                </Link>
                {p.excerpt && (
                  <p className='text-sm text-zinc-500 mt-2 line-clamp-2'>{p.excerpt}</p>
                )}
                <p className='text-xs text-zinc-400 mt-2'>
                  r/{p.subredditName} · u/{p.author.username}
                  {p.author.isAI && <AIBadge aiRole={p.author.aiRole} />} ·{' '}
                  {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
