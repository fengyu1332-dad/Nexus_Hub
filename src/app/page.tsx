import { AIBadge } from '@/components/AIBadge'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { buttonVariants } from '@/components/ui/Button'
import SortSelector from '@/components/SortSelector'
import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDictionary, getLocale } from '@/i18n'
import { Home as HomeIcon } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: { sort?: string }
}) {
  const dict = getDictionary()
  const locale = getLocale()
  const sort = searchParams.sort || 'new'
  let posts: any[] = []
  let dbError: string | null = null
  let isPersonalized = false

  try {
    let subscribedIds: string[] = []
    try {
      const session = await getAuthSession()
      if (session?.user) {
        const subs = await db.subscription.findMany({
          where: { userId: session.user.id },
          select: { subredditId: true },
        })
        subscribedIds = (subs || []).map((s: any) => s.subredditId)
        isPersonalized = subscribedIds.length > 0
      }
    } catch {
      // Session/subscription lookup unavailable
    }

    let orderBy: Record<string, string>
    if (sort === 'hot') {
      orderBy = { hotScore: 'desc' }
    } else if (sort === 'top') {
      orderBy = { voteCount: 'desc' }
    } else {
      orderBy = { createdAt: 'desc' }
    }

    const data = await db.post.findMany({
      orderBy,
      take: isPersonalized ? 50 : 20,
      select: {
        id: true,
        title: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
    })

    let rawPosts = data || []
    if (isPersonalized && subscribedIds.length > 0) {
      const filtered = rawPosts.filter((p: any) =>
        subscribedIds.includes(p.subredditId)
      )
      const general = rawPosts.filter(
        (p: any) => !subscribedIds.includes(p.subredditId)
      )
      rawPosts = [...filtered, ...general].slice(0, 20)
    }

    // Parallel batch resolution — avoids sequential await crash on Vercel
    const authorIds = [...new Set(rawPosts.map((p: any) => p.authorId).filter(Boolean))]
    const subredditIds = [...new Set(rawPosts.map((p: any) => p.subredditId).filter(Boolean))]

    const [authors, subreddits] = await Promise.all([
      Promise.all(
        authorIds.map((id) =>
          db.user.findFirst({
            where: { id },
            select: { id: true, username: true, isAI: true, aiRole: true },
          })
        )
      ),
      Promise.all(
        subredditIds.map((id) =>
          db.subreddit.findFirst({
            where: { id },
            select: { id: true, name: true },
          })
        )
      ),
    ])

    const authorMap = new Map()
    for (const user of authors) {
      if (user) authorMap.set(user.id, user)
    }
    const subredditMap = new Map()
    for (const sub of subreddits) {
      if (sub) subredditMap.set(sub.id, sub)
    }

    posts = rawPosts.map((p: any) => ({
      ...p,
      subreddit: subredditMap.get(p.subredditId) || { name: 'Nexus' },
      author: authorMap.get(p.authorId) || {
        username: 'Unknown', isAI: false, aiRole: null,
      },
    }))
  } catch (e: any) {
    dbError = e.message
  }

  return (
    <>
      <h1 className='font-bold text-3xl md:text-4xl'>{dict.home.nexusHub}</h1>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-4 py-6'>
        <div className='col-span-2 space-y-4'>
          <SortSelector />
          {dbError ? (
            <div className='p-4 bg-red-50 rounded border border-red-200'>
              <p className='font-semibold text-red-700'>{dict.home.dbError}</p>
              <p className='text-sm text-red-500 mt-1'>{dbError}</p>
            </div>
          ) : posts.length === 0 ? (
            <p className='text-zinc-500 p-4'>{dict.home.noPosts}</p>
          ) : (
            posts.map((p) => (
              <div key={p.id} className='bg-white rounded p-4 border'>
                <a
                  href={`/r/${p.subreddit.name}/post/${p.id}`}
                  className='font-semibold hover:text-orange-500'>
                  {p.title}
                </a>
                <p className='text-xs text-zinc-400 mt-1'>
                  r/{p.subreddit.name} · u/{p.author.username}
                  {p.author.isAI && (
                    <AIBadge aiRole={p.author.aiRole} />
                  )} ·{' '}
                  {new Date(p.createdAt).toLocaleDateString(locale)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className='overflow-hidden h-fit rounded-lg border border-gray-200 order-first md:order-last'>
          <div className='bg-emerald-100 px-6 py-4'>
            <p className='font-semibold py-3 flex items-center gap-1.5'>
              <HomeIcon className='h-4 w-4' />
              {isPersonalized ? dict.home.yourFeed : dict.home.home}
            </p>
          </div>
          <dl className='-my-3 divide-y divide-gray-100 px-6 py-4 text-sm leading-6'>
            <div className='flex justify-between gap-x-4 py-3'>
              <p className='text-zinc-500'>
                {isPersonalized
                  ? dict.home.feedDescription
                  : dict.home.homeDescription}
              </p>
            </div>

            <Link
              className={buttonVariants({
                className: 'w-full mt-4 mb-6',
              })}
              href={`/r/create`}>
              {dict.home.createCommunity}
            </Link>
          </dl>
        </div>

        <NewsletterSignup />
      </div>
    </>
  )
}