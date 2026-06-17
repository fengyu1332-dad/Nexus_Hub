'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2 } from 'lucide-react'

interface PipelineExec {
  id: string
  pipelineType: string
  status: string
  entityId?: string
  inputSummary?: string
  outputSummary?: string
  errorMessage?: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  retryCount: number
}

const TYPE_LABELS: Record<string, string> = {
  ai_publish: 'AI Publish',
  embedding: 'Embedding',
  flora_auto_reply: 'Flora Reply',
  crawl: 'Crawl',
  dedup_check: 'Dedup',
  tag_classify: 'Tag Classify',
  semantic_search: 'Semantic',
}

const STATUS_PILL: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  running: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  dead_letter: 'bg-zinc-200 text-zinc-500',
}

export function PipelineExecutionsList({
  type,
  status,
  limit,
}: {
  type?: string
  status?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (status) params.set('status', status)
  if (limit) params.set('limit', String(limit))

  const { data: executions, isLoading } = useQuery({
    queryKey: ['pipeline-executions', type, status, limit],
    queryFn: async () => {
      const { data } = await axios.get(`/api/admin/pipeline-executions?${params.toString()}`)
      return data as PipelineExec[]
    },
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
      </div>
    )
  }

  if (!executions || executions.length === 0) {
    return <p className='text-sm text-zinc-400 py-4 text-center'>No executions found</p>
  }

  return (
    <div className='border border-zinc-200 rounded-lg overflow-hidden'>
      <table className='w-full text-xs'>
        <thead className='bg-zinc-50 border-b border-zinc-200'>
          <tr>
            <th className='text-left px-3 py-2 font-medium text-zinc-600'>Type</th>
            <th className='text-left px-3 py-2 font-medium text-zinc-600'>Status</th>
            <th className='text-left px-3 py-2 font-medium text-zinc-600 hidden sm:table-cell'>Input</th>
            <th className='text-left px-3 py-2 font-medium text-zinc-600 hidden md:table-cell'>Error</th>
            <th className='text-right px-3 py-2 font-medium text-zinc-600'>Duration</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-zinc-100'>
          {executions.map((e) => (
            <tr key={e.id} className='hover:bg-zinc-50/50'>
              <td className='px-3 py-2'>
                <span className='text-zinc-600'>{TYPE_LABELS[e.pipelineType] || e.pipelineType}</span>
              </td>
              <td className='px-3 py-2'>
                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL[e.status] || 'bg-zinc-100'}`}>
                  {e.status}
                </span>
                {e.retryCount > 0 && (
                  <span className='text-zinc-400 ml-1'>×{e.retryCount}</span>
                )}
              </td>
              <td className='px-3 py-2 text-zinc-500 hidden sm:table-cell max-w-[200px] truncate'>
                {e.inputSummary || '—'}
              </td>
              <td className='px-3 py-2 text-red-500 hidden md:table-cell max-w-[200px] truncate'>
                {e.errorMessage || '—'}
              </td>
              <td className='px-3 py-2 text-right text-zinc-400'>
                {e.durationMs != null ? `${e.durationMs}ms` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
