'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { AlertTriangle, Lightbulb, Tag, Archive } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Suggestion {
  topic: string
  reason: string
  type: 'gap_fill' | 'trending' | 'evergreen'
}

export function ContentGapsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['content-gaps'],
    queryFn: async () => {
      const { data } = await axios.get('/api/admin/analytics?metric=tag_distribution')

      // Get subreddit info for inactivity check
      let subs: { name: string; postCount: number }[] = []
      try {
        const res = await axios.get('/api/admin/analytics?metric=overview')
        subs = []
      } catch { /* */ }

      // Derive simple gaps from tag distribution
      const tags = (data || []) as { name: string; count: number }[]
      const uncoveredTags = tags.filter((t: any) => t.count < 3)

      const suggestions: Suggestion[] = [
        ...uncoveredTags.slice(0, 3).map((t: any) => ({
          topic: `${t.name} 深度解析`,
          reason: `标签 "${t.name}" 仅 ${t.count} 篇，覆盖不足`,
          type: 'gap_fill' as const,
        })),
        { topic: '2026 秋季留学申请时间线', reason: '常青内容，持续有价值', type: 'evergreen' as const },
        { topic: '留学文书的五大常见误区', reason: '高搜索量主题', type: 'evergreen' as const },
      ].slice(0, 5)

      return { uncoveredTags, suggestions }
    },
    refetchInterval: 120_000,
  })

  if (isLoading) {
    return (
      <div className='border border-zinc-200 rounded-xl p-5 bg-white animate-pulse'>
        <div className='h-4 bg-zinc-100 rounded w-24 mb-3' />
        <div className='space-y-2'>
          {[...Array(3)].map((_, i) => (
            <div key={i} className='h-8 bg-zinc-50 rounded' />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
      <div className='flex items-center gap-2 mb-3'>
        <Lightbulb className='h-4 w-4 text-amber-500' />
        <h3 className='text-sm font-semibold text-zinc-800'>内容缺口 & 建议主题</h3>
      </div>

      {data?.uncoveredTags && data.uncoveredTags.length > 0 && (
        <div className='mb-4'>
          <p className='text-xs text-zinc-400 mb-2 flex items-center gap-1'>
            <AlertTriangle className='h-3 w-3' />
            覆盖不足的标签
          </p>
          <div className='flex flex-wrap gap-1.5'>
            {data.uncoveredTags.map((tag: any) => (
              <span
                key={tag.name}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                  tag.count === 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-amber-50 text-amber-600'
                )}>
                <Tag className='h-2.5 w-2.5' />
                {tag.name} ({tag.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {data?.suggestions && data.suggestions.length > 0 && (
        <div>
          <p className='text-xs text-zinc-400 mb-2'>建议写作主题</p>
          <div className='space-y-1.5'>
            {data.suggestions.map((s: Suggestion, i: number) => (
              <div key={i} className='flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-lg'>
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  s.type === 'gap_fill' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                )}>
                  {s.type === 'gap_fill' ? '补缺' : '常青'}
                </span>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm text-zinc-700 truncate'>{s.topic}</p>
                  <p className='text-[11px] text-zinc-400'>{s.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
