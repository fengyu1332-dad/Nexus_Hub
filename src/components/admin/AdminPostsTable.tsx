'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import axios from 'axios'

interface Post {
  id: string
  title: string
  author: { username: string | null } | null
  subreddit: { name: string } | null
  createdAt: string
}

export function AdminPostsTable({
  initialPosts,
  deleteLabel,
}: {
  initialPosts: Post[]
  deleteLabel: string
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (post: Post) => {
    if (!confirm(`删除帖子 "${post.title}"？此操作不可撤销。`)) return
    setDeleting(post.id)
    try {
      await axios.delete(`/api/admin/posts/${post.id}`)
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch {
      alert('删除失败，请重试')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='border border-zinc-200 rounded-lg overflow-hidden'>
        {loading && (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
          </div>
        )}
        {!loading && posts.length === 0 && (
          <p className='text-zinc-500 text-sm py-8 text-center'>暂无帖子</p>
        )}
        {!loading && posts.length > 0 && (
          <table className='w-full text-sm'>
            <thead className='bg-zinc-50 border-b border-zinc-200'>
              <tr>
                <th className='text-left px-4 py-3 font-medium text-zinc-600'>标题</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600 hidden sm:table-cell'>作者</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600 hidden md:table-cell'>社区</th>
                <th className='text-right px-4 py-3 font-medium text-zinc-600 w-20'>操作</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-zinc-100'>
              {posts.map((post) => (
                <tr key={post.id} className='hover:bg-zinc-50/50'>
                  <td className='px-4 py-2.5'>
                    <a
                      href={`/r/${(post.subreddit as any)?.name || 'DevShowcase'}/post/${post.id}`}
                      target='_blank'
                      rel='noopener'
                      className='font-medium text-zinc-900 hover:text-orange-500 line-clamp-1'>
                      {post.title}
                    </a>
                  </td>
                  <td className='px-4 py-2.5 text-zinc-500 hidden sm:table-cell'>
                    u/{post.author?.username || 'Unknown'}
                  </td>
                  <td className='px-4 py-2.5 text-zinc-500 hidden md:table-cell'>
                    r/{(post.subreddit as any)?.name || '—'}
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
      <p className='text-xs text-zinc-400'>显示最近 50 条帖子</p>
    </div>
  )
}
