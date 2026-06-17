'use client'

import { useState, useMemo } from 'react'
import { Loader2, Trash2, CheckSquare, Square, Pin } from 'lucide-react'
import axios from 'axios'
import { getDisplayName } from '@/lib/subreddit'
import { AIBadge } from '@/components/AIBadge'

interface Post {
  id: string
  title: string
  author: { username: string | null; isAI?: boolean; aiRole?: string | null } | null
  subreddit: { name: string; displayName?: string | null } | null
  createdAt: string
  isPinned?: boolean
}

type FilterTab = 'all' | 'ai' | 'human'

export function AdminPostsTable({
  initialPosts,
  deleteLabel,
}: {
  initialPosts: Post[]
  deleteLabel: string
  pinPostLabel: string
  unpinPostLabel: string
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [pinning, setPinning] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterTab>('all')
  const [batchDeleting, setBatchDeleting] = useState(false)

  const filteredPosts = useMemo(() => {
    if (filter === 'ai') return posts.filter((p) => p.author?.isAI)
    if (filter === 'human') return posts.filter((p) => !p.author?.isAI)
    return posts
  }, [posts, filter])

  const aiCount = posts.filter((p) => p.author?.isAI).length
  const humanCount = posts.filter((p) => !p.author?.isAI).length

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filteredPosts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredPosts.map((p) => p.id)))
    }
  }

  const handleDelete = async (post: Post) => {
    if (!confirm(`删除帖子 "${post.title}"？此操作不可撤销。`)) return
    setDeleting(post.id)
    try {
      await axios.delete(`/api/admin/posts/${post.id}`)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(post.id)
        return next
      })
    } catch {
      alert('删除失败，请重试')
    } finally {
      setDeleting(null)
    }
  }

  const handlePin = async (post: Post) => {
    setPinning(post.id)
    try {
      const { data } = await axios.patch(`/api/admin/posts/${post.id}/pin`)
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, isPinned: data.isPinned } : p))
      )
    } catch {
      alert('操作失败，请重试')
    } finally {
      setPinning(null)
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`确定删除选中的 ${selected.size} 篇帖子？此操作不可撤销。`)) return
    setBatchDeleting(true)
    try {
      const { data } = await axios.post('/api/admin/posts/batch', {
        ids: Array.from(selected),
      })
      setPosts((prev) => prev.filter((p) => !selected.has(p.id)))
      setSelected(new Set())
      alert(`已删除 ${data.deleted} 篇，失败 ${data.failed} 篇`)
    } catch {
      alert('批量删除失败，请重试')
    } finally {
      setBatchDeleting(false)
    }
  }

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: posts.length },
    { key: 'ai', label: 'AI 生成', count: aiCount },
    { key: 'human', label: '真人', count: humanCount },
  ]

  return (
    <div className='space-y-4'>
      {/* Filter tabs + batch actions */}
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div className='flex items-center gap-1 bg-zinc-100 rounded-lg p-1'>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setFilter(t.key); setSelected(new Set()) }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === t.key
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}>
              {t.label}
              <span className='ml-1 text-xs text-zinc-400'>{t.count}</span>
            </button>
          ))}
        </div>

        {selected.size > 0 && (
          <button
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors'>
            {batchDeleting ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Trash2 className='h-4 w-4' />
            )}
            删除选中 ({selected.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className='border border-zinc-200 rounded-lg overflow-hidden'>
        {filteredPosts.length === 0 ? (
          <p className='text-zinc-500 text-sm py-8 text-center'>暂无帖子</p>
        ) : (
          <table className='w-full text-sm'>
            <thead className='bg-zinc-50 border-b border-zinc-200'>
              <tr>
                <th className='text-left px-3 py-3 w-10'>
                  <button onClick={toggleAll} className='text-zinc-400 hover:text-zinc-600'>
                    {selected.size === filteredPosts.length && filteredPosts.length > 0 ? (
                      <CheckSquare className='h-4 w-4' />
                    ) : (
                      <Square className='h-4 w-4' />
                    )}
                  </button>
                </th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600'>标题</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600 hidden sm:table-cell'>作者</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600 hidden md:table-cell'>社区</th>
                <th className='text-center px-2 py-3 font-medium text-zinc-600 w-12'>置顶</th>
                <th className='text-right px-4 py-3 font-medium text-zinc-600 w-20'>操作</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-zinc-100'>
              {filteredPosts.map((post) => (
                <tr key={post.id} className={`hover:bg-zinc-50/50 ${selected.has(post.id) ? 'bg-amber-50/50' : ''}`}>
                  <td className='px-3 py-2.5'>
                    <button
                      onClick={() => toggleSelect(post.id)}
                      className='text-zinc-400 hover:text-zinc-600'>
                      {selected.has(post.id) ? (
                        <CheckSquare className='h-4 w-4 text-amber-500' />
                      ) : (
                        <Square className='h-4 w-4' />
                      )}
                    </button>
                  </td>
                  <td className='px-4 py-2.5'>
                    <a
                      href={`/r/${post.subreddit?.name || 'Nexus'}/post/${post.id}`}
                      target='_blank'
                      rel='noopener'
                      className='font-medium text-zinc-900 hover:text-orange-500 line-clamp-1'>
                      {post.title}
                    </a>
                  </td>
                  <td className='px-4 py-2.5 text-zinc-500 hidden sm:table-cell'>
                    <span className='inline-flex items-center gap-1'>
                      u/{post.author?.username || 'Unknown'}
                      {post.author?.isAI && <AIBadge aiRole={post.author?.aiRole} />}
                    </span>
                  </td>
                  <td className='px-4 py-2.5 text-zinc-500 hidden md:table-cell'>
                    {getDisplayName(post.subreddit?.name || '—', post.subreddit?.displayName)}
                  </td>
                  <td className='px-2 py-2.5 text-center'>
                    <button
                      onClick={() => handlePin(post)}
                      disabled={pinning === post.id}
                      title={post.isPinned ? unpinPostLabel : pinPostLabel}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-50 ${
                        post.isPinned
                          ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                          : 'text-zinc-400 hover:text-amber-500 hover:bg-amber-50'
                      }`}>
                      {pinning === post.id ? (
                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      ) : (
                        <Pin className='h-3.5 w-3.5' />
                      )}
                    </button>
                  </td>
                  <td className='px-4 py-2.5 text-right'>
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={deleting === post.id}
                      className='inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors'>
                      {deleting === post.id ? (
                        <Loader2 className='h-3 w-3 animate-spin' />
                      ) : (
                        <Trash2 className='h-3 w-3' />
                      )}
                      {deleteLabel}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className='text-xs text-zinc-400'>显示最近 {filteredPosts.length} 条帖子（共 {posts.length} 条）</p>
    </div>
  )
}
