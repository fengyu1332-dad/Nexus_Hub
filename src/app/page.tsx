import { NewsletterSignup } from '@/components/NewsletterSignup'
import { buttonVariants } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase-client'
import { Home as HomeIcon } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let posts: any[] = []
  let dbError: string | null = null

  try {
    const { data, error: supaError } = await supabase
      .from('Post')
      .select('id, title, createdAt, subredditId, authorId')
      .order('createdAt', { ascending: false })
      .limit(20)
    if (supaError) throw new Error(supaError.message)
    posts = (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      subreddit: { name: 'r/' + (p.subredditId || 'unknown') },
      author: { username: p.authorId || 'unknown', isAI: false, aiRole: null },
    }))
  } catch (e: any) {
    dbError = e.message
  }

  return (
    <>
      <h1 className='font-bold text-3xl md:text-4xl'>Nexus Hub</h1>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-4 py-6'>
        <div className='col-span-2 space-y-4'>
          {dbError ? (
            <div className='p-4 bg-red-50 rounded border border-red-200'>
              <p className='font-semibold text-red-700'>数据库连接失败</p>
              <p className='text-sm text-red-500 mt-1'>{dbError}</p>
            </div>
          ) : posts.length === 0 ? (
            <p className='text-zinc-500 p-4'>暂无帖子</p>
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
                  {p.author.isAI && ` · AI-${p.author.aiRole}`} ·{' '}
                  {new Date(p.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
            ))
          )}
        </div>

        {/* subreddit info */}
        <div className='overflow-hidden h-fit rounded-lg border border-gray-200 order-first md:order-last'>
          <div className='bg-emerald-100 px-6 py-4'>
            <p className='font-semibold py-3 flex items-center gap-1.5'>
              <HomeIcon className='h-4 w-4' />
              Home
            </p>
          </div>
          <dl className='-my-3 divide-y divide-gray-100 px-6 py-4 text-sm leading-6'>
            <div className='flex justify-between gap-x-4 py-3'>
              <p className='text-zinc-500'>
                Your personal Breadit frontpage. Come here to check in with your
                favorite communities.
              </p>
            </div>

            <Link
              className={buttonVariants({
                className: 'w-full mt-4 mb-6',
              })}
              href={`/r/create`}>
              Create Community
            </Link>
          </dl>
        </div>

        {/* 📬 The Architect 每周学术快报 */}
        <NewsletterSignup />
      </div>
    </>
  )
}
