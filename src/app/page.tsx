import { db } from '@/lib/db'
import { getDictionary } from '@/i18n'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const dict = getDictionary()
  let posts: any[] = []
  let dbError: string | null = null

  try {
    const data = await db.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    })
    posts = data || []
  } catch (e: any) {
    dbError = e.message
  }

  return (
    <div className='p-8'>
      <h1 className='font-bold text-3xl md:text-4xl'>{dict.home.nexusHub}</h1>
      {dbError ? (
        <p className='text-red-500 mt-2'>DB Error: {dbError}</p>
      ) : (
        <ul className='mt-4 space-y-2'>
          {posts.map((p: any) => (
            <li key={p.id} className='text-sm text-zinc-600'>{p.title}</li>
          ))}
        </ul>
      )}
    </div>
  )
}