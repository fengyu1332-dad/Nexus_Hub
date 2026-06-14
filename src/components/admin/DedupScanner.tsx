'use client'

import { useState } from 'react'
import { Loader2, Search, Trash2, ExternalLink } from 'lucide-react'
import axios from 'axios'
import { getDisplayName } from '@/lib/subreddit'

interface DupResult {
  postA: {
    id: string; title: string; createdAt: string
    author?: { username?: string; isAI?: boolean; aiRole?: string | null }
    subreddit?: { name?: string; displayName?: string | null }
  }
  postB: {
    id: string; title: string; createdAt: string
    author?: { username?: string; isAI?: boolean; aiRole?: string | null }
    subreddit?: { name?: string; displayName?: string | null }
  }
  reason: string
  score: number
}

export function DedupScanner() {
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<DupResult[]>([])
  const [summary, setSummary] = useState<{ totalScanned: number; duplicatesFound: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const handleScan = async () => {
    setScanning(true)
    setError(null)
    try {
      const { data } = await axios.get('/api/admin/dedup-scan')
      setResults(data.results || [])
      setSummary({ totalScanned: data.totalScanned, duplicatesFound: data.duplicatesFound })
    } catch (err: any) {
      setError(err?.response?.data?.error || '扫描失败，请重试')
    } finally {
      setScanning(false)
    }
  }

  const handleDeletePost = async (id: string) => {
    if (!confirm('确认删除此帖子？')) return
    setDeletingIds((prev) => new Set(prev).add(id))
    try {
      await axios.delete(`/api/admin/posts/${id}`)
      setResults((prev) =>
        prev
          .filter((r) => r.postA.id !== id && r.postB.id !== id)
          .map((r) => {
            // Clean up deleted post reference
            if (r.postA.id === id) return { ...r, postA: { ...r.postB, title: '', createdAt: '', id: '' } }
            if (r.postB.id === id) return { ...r, postB: { ...r.postA, title: '', createdAt: '', id: '' } }
            return r
          })
          .filter((r) => r.postA.id && r.postB.id)
      )
    } catch {
      alert('删除失败')
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold text-zinc-800'>去重扫描</h2>
          <p className='text-xs text-zinc-500 mt-0.5'>
            扫描最近 500 篇帖子，检测标题相同、高度相似或正文重复的内容
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors'>
          {scanning ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <Search className='h-4 w-4' />
          )}
          {scanning ? '扫描中...' : '开始扫描'}
        </button>
      </div>

      {error && (
        <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>
          {error}
        </div>
      )}

      {summary && !error && (
        <div className='flex gap-4 text-sm'>
          <span className='text-zinc-500'>
            已扫描 <strong className='text-zinc-800'>{summary.totalScanned}</strong> 篇
          </span>
          {summary.duplicatesFound > 0 ? (
            <span className='text-amber-600'>
              发现 <strong>{summary.duplicatesFound}</strong> 组疑似重复
            </span>
          ) : (
            <span className='text-emerald-600'>未发现重复内容</span>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className='space-y-3 max-h-[600px] overflow-y-auto'>
          {results.map((dup, idx) => (
            <div key={idx} className='bg-white rounded-lg border border-zinc-200 p-4'>
              <div className='flex items-center gap-2 mb-3'>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  dup.score >= 0.95 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {dup.reason}
                </span>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {[dup.postA, dup.postB].map((post, pi) => (
                  <div key={post.id} className='border border-zinc-100 rounded p-3'>
                    <div className='flex items-start justify-between gap-2'>
                      <a
                        href={`/r/${post.subreddit?.name || 'Nexus'}/post/${post.id}`}
                        target='_blank'
                        rel='noopener'
                        className='text-sm font-medium text-zinc-800 hover:text-orange-500 line-clamp-2 flex-1'>
                        {post.title}
                      </a>
                      <div className='flex items-center gap-1 flex-shrink-0'>
                        <a
                          href={`/r/${post.subreddit?.name || 'Nexus'}/post/${post.id}`}
                          target='_blank'
                          rel='noopener'
                          className='text-zinc-400 hover:text-zinc-600'
                          title='打开'>
                          <ExternalLink className='h-3.5 w-3.5' />
                        </a>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletingIds.has(post.id)}
                          className='text-zinc-400 hover:text-red-600 disabled:opacity-50'
                          title='删除'>
                          {deletingIds.has(post.id) ? (
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                          ) : (
                            <Trash2 className='h-3.5 w-3.5' />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className='flex items-center gap-1.5 mt-2 text-xs text-zinc-400'>
                      <span>r/{getDisplayName(post.subreddit?.name || '—', post.subreddit?.displayName)}</span>
                      <span>·</span>
                      <span>u/{post.author?.username || 'Unknown'}</span>
                      <span>·</span>
                      <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
