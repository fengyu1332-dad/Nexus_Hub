import { db } from '@/lib/db'
import Link from 'next/link'
import { BookOpen, GraduationCap, Globe, Plane, Briefcase } from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  exams: <BookOpen className='h-4 w-4' />,
  applications: <GraduationCap className='h-4 w-4' />,
  insights: <Globe className='h-4 w-4' />,
  visa: <Plane className='h-4 w-4' />,
  career: <Briefcase className='h-4 w-4' />,
}

const CATEGORY_LABELS: Record<string, string> = {
  exams: '标化考试',
  applications: '申请实战',
  insights: '院校洞见',
  visa: '签证与行前',
  career: '留学之后',
}

export default async function BoardSidebar() {
  let boards: any[] = []
  try {
    boards = await db.subreddit.findMany({
      where: { isOfficial: true },
      orderBy: { sortOrder: 'asc' },
      select: { name: true, category: true, description: true },
    })
  } catch {
    // DB not ready — render empty sidebar
  }

  const grouped: Record<string, typeof boards> = {}
  for (const b of boards) {
    const cat = b.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(b)
  }

  return (
    <div className='overflow-hidden rounded-lg border border-gray-200 bg-white'>
      <div className='bg-emerald-100 px-4 py-3'>
        <p className='font-semibold text-sm'>讨论区板块</p>
        <p className='text-xs text-zinc-500 mt-0.5'>AI 持续聚合最新情报</p>
      </div>

      <div className='px-3 py-2 text-sm'>
        {Object.keys(CATEGORY_LABELS).map((cat) => {
          const list = grouped[cat]
          if (!list || list.length === 0) return null
          return (
            <div key={cat} className='mb-3 last:mb-0'>
              <p className='flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1 px-1'>
                {CATEGORY_ICONS[cat]}
                {CATEGORY_LABELS[cat]}
              </p>
              {list.map((b) => (
                <Link
                  key={b.name}
                  href={`/r/${b.name}`}
                  className='block rounded px-2 py-1.5 -mx-1 text-zinc-700 hover:bg-zinc-100 hover:text-orange-600 transition-colors'
                  title={b.description || ''}>
                  r/{b.name}
                </Link>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
