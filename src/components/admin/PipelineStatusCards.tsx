'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { cn } from '@/lib/utils'

interface TypeAgg {
  pipelineType: string
  total: number
  success: number
  failed: number
  dead: number
  pending: number
  successRate: number
  avgDurationMs: number | null
}

interface PipelineAgg {
  total: number
  totalSuccess: number
  overallSuccessRate: number
  byType: TypeAgg[]
}

const TYPE_LABELS: Record<string, string> = {
  ai_publish: 'AI Publish',
  embedding: 'Embedding',
  embedding_backfill: 'Embed Backfill',
  flora_auto_reply: 'Flora Reply',
  crawl: 'Crawl',
  dedup_check: 'Dedup',
  tag_classify: 'Tag Classify',
  semantic_search: 'Semantic',
  newsletter_send: 'Newsletter',
  atmosphere_builder: 'Atmosphere',
}

export function PipelineStatusCards() {
  const { data, isLoading } = useQuery({
    queryKey: ['pipeline-aggregate'],
    queryFn: async () => {
      const { data } = await axios.get('/api/admin/pipeline-executions?aggregate=true')
      return data as PipelineAgg
    },
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        {[...Array(4)].map((_, i) => (
          <div key={i} className='border border-zinc-200 rounded-xl p-4 bg-white animate-pulse'>
            <div className='h-3 bg-zinc-100 rounded w-16 mb-2' />
            <div className='h-8 bg-zinc-100 rounded w-12' />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className='border border-zinc-200 rounded-xl p-8 text-center text-sm text-zinc-400'>
        No pipeline execution data yet
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Overall KPI cards */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='border border-zinc-200 rounded-xl p-4 bg-white'>
          <p className='text-xs text-zinc-400'>Total Executions</p>
          <p className='text-2xl font-bold text-zinc-900'>{data.total}</p>
        </div>
        <div className='border border-zinc-200 rounded-xl p-4 bg-white'>
          <p className='text-xs text-zinc-400'>Success Rate</p>
          <p className={cn(
            'text-2xl font-bold',
            data.overallSuccessRate >= 80 ? 'text-emerald-600' : data.overallSuccessRate >= 50 ? 'text-amber-600' : 'text-red-600'
          )}>
            {data.overallSuccessRate}%
          </p>
        </div>
        <div className='border border-zinc-200 rounded-xl p-4 bg-white'>
          <p className='text-xs text-zinc-400'>Succeeded</p>
          <p className='text-2xl font-bold text-emerald-600'>{data.totalSuccess}</p>
        </div>
        <div className='border border-zinc-200 rounded-xl p-4 bg-white'>
          <p className='text-xs text-zinc-400'>Failed / Dead</p>
          <p className='text-2xl font-bold text-red-500'>
            {data.byType.reduce((s, t) => s + t.failed + t.dead, 0)}
          </p>
        </div>
      </div>

      {/* Per-type breakdown */}
      <div className='border border-zinc-200 rounded-xl overflow-hidden bg-white'>
        <div className='px-5 py-3 border-b border-zinc-100'>
          <h3 className='text-sm font-semibold text-zinc-800'>By Pipeline Type</h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-xs'>
            <thead>
              <tr className='border-b border-zinc-100 bg-zinc-50 text-zinc-500'>
                <th className='text-left px-4 py-2 font-medium'>Type</th>
                <th className='text-center px-3 py-2 font-medium'>Total</th>
                <th className='text-center px-3 py-2 font-medium'>Success</th>
                <th className='text-center px-3 py-2 font-medium'>Failed</th>
                <th className='text-center px-3 py-2 font-medium'>Dead</th>
                <th className='text-center px-3 py-2 font-medium'>Pending</th>
                <th className='text-right px-4 py-2 font-medium'>Rate</th>
                <th className='text-right px-4 py-2 font-medium hidden sm:table-cell'>Avg Duration</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-zinc-50'>
              {data.byType.map((item) => (
                <tr key={item.pipelineType} className='hover:bg-zinc-50/50'>
                  <td className='px-4 py-2 font-medium text-zinc-700'>
                    {TYPE_LABELS[item.pipelineType] || item.pipelineType}
                  </td>
                  <td className='px-3 py-2 text-center text-zinc-600'>{item.total}</td>
                  <td className='px-3 py-2 text-center text-emerald-600'>{item.success}</td>
                  <td className='px-3 py-2 text-center text-red-500'>{item.failed}</td>
                  <td className='px-3 py-2 text-center text-zinc-400'>{item.dead}</td>
                  <td className='px-3 py-2 text-center text-amber-500'>{item.pending}</td>
                  <td className='px-4 py-2 text-right'>
                    <span className={cn(
                      'inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                      item.successRate >= 80 ? 'bg-emerald-100 text-emerald-700' :
                      item.successRate >= 50 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      {item.successRate}%
                    </span>
                  </td>
                  <td className='px-4 py-2 text-right text-zinc-400 hidden sm:table-cell'>
                    {item.avgDurationMs != null ? `${item.avgDurationMs}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
