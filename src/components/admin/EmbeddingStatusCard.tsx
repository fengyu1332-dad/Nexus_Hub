'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Brain, RefreshCw, AlertTriangle } from 'lucide-react'

interface EmbeddingStatusCardProps {
  labels: {
    embeddingStatus: string
    embeddingCoverage: string
    postsWithEmbeddings: string
    pendingEmbeddingJobs: string
    failedEmbeddingJobs: string
    backfillEmbeddings: string
    noEmbeddingKey: string
  }
}

export function EmbeddingStatusCard({ labels }: EmbeddingStatusCardProps) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['embedding-status'],
    queryFn: async () => {
      const res = await axios.get('/api/admin/embedding-backfill')
      return res.data
    },
    refetchInterval: 60_000,
  })

  const backfillMutation = useMutation({
    mutationFn: async () => {
      await axios.post('/api/admin/embedding-backfill')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embedding-status'] })
    },
  })

  const coverage = data?.coverage || 0
  const totalPosts = data?.totalPosts || 0
  const withEmbedding = data?.withEmbedding || 0
  const pendingJobs = data?.pendingJobs || 0
  const failedJobs = data?.failedJobs || 0
  const hasKey = !data?.error && !error

  return (
    <div className='bg-white rounded-lg border border-zinc-200 p-5'>
      <div className='flex items-center gap-2 mb-4'>
        <Brain className='h-5 w-5 text-violet-600' />
        <h3 className='font-semibold text-zinc-900'>{labels.embeddingStatus}</h3>
      </div>

      {isLoading ? (
        <div className='text-sm text-zinc-400'>Loading...</div>
      ) : !hasKey ? (
        <div className='flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded p-3'>
          <AlertTriangle className='h-4 w-4' />
          {labels.noEmbeddingKey}
        </div>
      ) : (
        <div className='space-y-3'>
          <div>
            <div className='flex items-center justify-between text-sm mb-1'>
              <span className='text-zinc-500'>{labels.embeddingCoverage}</span>
              <span className='font-semibold text-zinc-700'>{coverage}%</span>
            </div>
            <div className='w-full bg-zinc-100 rounded-full h-2'>
              <div
                className='h-2 rounded-full bg-violet-500 transition-all'
                style={{ width: `${coverage}%` }}
              />
            </div>
            <div className='text-xs text-zinc-400 mt-1'>
              {withEmbedding} / {totalPosts} {labels.postsWithEmbeddings}
            </div>
          </div>

          <div className='flex gap-4 text-sm'>
            <div className='flex-1 bg-amber-50 rounded p-2 text-center'>
              <div className='font-bold text-amber-700'>{pendingJobs}</div>
              <div className='text-xs text-amber-600'>{labels.pendingEmbeddingJobs}</div>
            </div>
            <div className='flex-1 bg-red-50 rounded p-2 text-center'>
              <div className='font-bold text-red-700'>{failedJobs}</div>
              <div className='text-xs text-red-600'>{labels.failedEmbeddingJobs}</div>
            </div>
          </div>

          <button
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isLoading}
            className='w-full flex items-center justify-center gap-2 text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 px-4 py-2 rounded transition-colors'>
            <RefreshCw className={`h-4 w-4 ${backfillMutation.isLoading ? 'animate-spin' : ''}`} />
            {labels.backfillEmbeddings}
          </button>

          {backfillMutation.isSuccess && (
            <p className='text-xs text-emerald-600 text-center'>
              {(backfillMutation.data as any)?.message || 'Backfill completed'}
            </p>
          )}
          {backfillMutation.isError && (
            <p className='text-xs text-red-600 text-center'>
              Backfill failed
            </p>
          )}
        </div>
      )}
    </div>
  )
}
