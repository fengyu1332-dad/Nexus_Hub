'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, RefreshCw, ThumbsDown, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LowQualityPost {
  id: string
  title: string
  authorRole: string
  subredditName: string
  voteCount: number
  commentCount: number
  helpfulRatio: number
  feedbackCount: number
  createdAt: string
}

export function QualityRewriter() {
  const queryClient = useQueryClient()
  const [rewriting, setRewriting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { id: string; title: string }>>({})

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['low-quality-posts'],
    queryFn: async () => {
      const { data } = await axios.get('/api/admin/quality-rewrite?days=7')
      return (data.posts || []) as LowQualityPost[]
    },
    refetchInterval: 60_000,
  })

  const handleRewrite = useCallback(async (post: LowQualityPost) => {
    setRewriting(post.id)
    try {
      const { data } = await axios.post('/api/admin/quality-rewrite', {
        postId: post.id,
        originalTitle: post.title,
      })
      setResults((prev) => ({
        ...prev,
        [post.id]: { id: data.rewrittenPostId, title: data.rewrittenTitle },
      }))
      queryClient.invalidateQueries({ queryKey: ['low-quality-posts'] })
    } catch (err: any) {
      console.error('Rewrite failed:', err)
    } finally {
      setRewriting(null)
    }
  }, [queryClient])

  if (isLoading) {
    return (
      <div className='flex justify-center py-8'>
        <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className='text-center py-8 text-zinc-400'>
        <ThumbsDown className='h-8 w-8 mx-auto mb-2 opacity-50' />
        <p className='text-sm'>暂无低质量帖子</p>
        <p className='text-xs mt-1'>所有 AI 内容表现良好</p>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-semibold text-zinc-800'>
          低质量 AI 帖子 <span className='text-zinc-400 font-normal'>({data.length})</span>
        </h3>
        <button
          onClick={() => refetch()}
          className='flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700'>
          <RefreshCw className='h-3 w-3' />
          刷新
        </button>
      </div>

      <div className='border border-zinc-200 rounded-lg overflow-hidden'>
        <table className='w-full text-xs'>
          <thead className='bg-zinc-50 border-b border-zinc-200'>
            <tr>
              <th className='text-left px-3 py-2 font-medium text-zinc-600'>标题</th>
              <th className='text-center px-2 py-2 font-medium text-zinc-600 w-14'>作者</th>
              <th className='text-center px-2 py-2 font-medium text-zinc-600 w-12'>票数</th>
              <th className='text-center px-2 py-2 font-medium text-zinc-600 w-12'>评论</th>
              <th className='text-center px-2 py-2 font-medium text-zinc-600 w-16'>有帮助率</th>
              <th className='text-right px-3 py-2 font-medium text-zinc-600 w-20'>操作</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-zinc-50'>
            {data.map((post) => {
              const rewriteResult = results[post.id]
              return (
                <tr key={post.id} className='hover:bg-zinc-50/50'>
                  <td className='px-3 py-2'>
                    <div className='flex items-center gap-1.5'>
                      <span className='text-zinc-700 line-clamp-1'>{post.title}</span>
                      <a
                        href={`/r/${post.subredditName}/post/${post.id}`}
                        target='_blank'
                        rel='noopener'
                        className='text-zinc-400 hover:text-zinc-600 flex-shrink-0'>
                        <ExternalLink className='h-3 w-3' />
                      </a>
                    </div>
                    <span className='text-zinc-400'>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                  </td>
                  <td className='px-2 py-2 text-center text-zinc-500'>{post.authorRole}</td>
                  <td className='px-2 py-2 text-center text-zinc-500'>{post.voteCount}</td>
                  <td className='px-2 py-2 text-center text-zinc-500'>{post.commentCount}</td>
                  <td className='px-2 py-2 text-center'>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                        post.helpfulRatio < 30 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                      )}>
                      {post.feedbackCount > 0 ? `${post.helpfulRatio}%` : 'N/A'}
                    </span>
                  </td>
                  <td className='px-3 py-2 text-right'>
                    {rewriteResult ? (
                      <a
                        href={`/r/Nexus/post/${rewriteResult.id}`}
                        target='_blank'
                        rel='noopener'
                        className='text-xs text-emerald-600 hover:text-emerald-700 font-medium'>
                        查看改写
                      </a>
                    ) : (
                      <button
                        onClick={() => handleRewrite(post)}
                        disabled={rewriting === post.id}
                        className='px-2 py-1 text-xs font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 rounded disabled:opacity-50 transition-colors'>
                        {rewriting === post.id ? (
                          <Loader2 className='h-3 w-3 animate-spin' />
                        ) : (
                          '改写'
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
