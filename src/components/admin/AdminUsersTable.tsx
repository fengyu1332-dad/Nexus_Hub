'use client'

import { useState } from 'react'
import { Loader2, Search, Shield, ShieldOff } from 'lucide-react'
import axios from 'axios'

interface User {
  id: string
  username: string | null
  email: string | null
  image: string | null
  isAI: boolean
  aiRole: string | null
  isAdmin: boolean
}

interface Labels {
  searchUsers: string
  noUsers: string
  makeAdmin: string
  removeAdmin: string
}

export function AdminUsersTable({
  initialUsers,
  initialTotal,
  initialPage,
  labels,
}: {
  initialUsers: User[]
  initialTotal: number
  initialPage: number
  labels: Labels
}) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(initialPage)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const limit = 20

  const fetchUsers = async (p: number, s: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (s) params.set('search', s)
      const res = await axios.get(`/api/admin/users?${params}`)
      setUsers(res.data.users)
      setTotal(res.data.total)
      setPage(res.data.page)
    } catch {
      // keep current data
    } finally {
      setLoading(false)
    }
  }

  const toggleAdmin = async (user: User) => {
    const updated = !user.isAdmin
    try {
      await axios.patch(`/api/admin/users/${user.id}`, { isAdmin: updated })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: updated } : u)))
    } catch {
      fetchUsers(page, search)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400' />
          <input
            type='text'
            placeholder={labels.searchUsers}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1, search)}
            className='w-full pl-9 pr-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300'
          />
        </div>
        <button
          onClick={() => fetchUsers(1, search)}
          className='px-3 py-2 bg-zinc-900 text-white text-sm rounded-md hover:bg-zinc-700'>
          搜索
        </button>
      </div>

      <div className='border border-zinc-200 rounded-lg overflow-hidden'>
        {loading && (
          <div className='flex items-center justify-center py-8'>
            <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
          </div>
        )}
        {!loading && users.length === 0 && (
          <p className='text-zinc-500 text-sm py-8 text-center'>{labels.noUsers}</p>
        )}
        {!loading && users.length > 0 && (
          <table className='w-full text-sm'>
            <thead className='bg-zinc-50 border-b border-zinc-200'>
              <tr>
                <th className='text-left px-4 py-3 font-medium text-zinc-600'>用户</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600 hidden sm:table-cell'>Email</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600'>角色</th>
                <th className='text-left px-4 py-3 font-medium text-zinc-600'>操作</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-zinc-100'>
              {users.map((user) => (
                <tr key={user.id} className='hover:bg-zinc-50/50'>
                  <td className='px-4 py-2.5'>
                    <div className='flex items-center gap-2'>
                      {user.image && (
                        <img src={user.image} alt='' className='w-6 h-6 rounded-full' />
                      )}
                      <span className='font-medium'>{user.username || '—'}</span>
                    </div>
                  </td>
                  <td className='px-4 py-2.5 text-zinc-500 hidden sm:table-cell'>
                    {user.email || '—'}
                  </td>
                  <td className='px-4 py-2.5'>
                    <div className='flex items-center gap-1 flex-wrap'>
                      {user.isAI && (
                        <span className='text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full'>
                          AI-{user.aiRole}
                        </span>
                      )}
                      {user.isAdmin && (
                        <span className='text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full'>
                          Admin
                        </span>
                      )}
                      {!user.isAI && !user.isAdmin && (
                        <span className='text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full'>
                          User
                        </span>
                      )}
                    </div>
                  </td>
                  <td className='px-4 py-2.5'>
                    <button
                      onClick={() => toggleAdmin(user)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors ${
                        user.isAdmin
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}>
                      {user.isAdmin ? (
                        <><ShieldOff className='h-3 w-3' /> {labels.removeAdmin}</>
                      ) : (
                        <><Shield className='h-3 w-3' /> {labels.makeAdmin}</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className='flex items-center justify-between text-sm text-zinc-500'>
          <span>共 {total} 用户</span>
          <div className='flex items-center gap-1'>
            <button
              onClick={() => fetchUsers(page - 1, search)}
              disabled={page <= 1}
              className='px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30'>
              上一页
            </button>
            <span className='px-2'>{page} / {totalPages}</span>
            <button
              onClick={() => fetchUsers(page + 1, search)}
              disabled={page >= totalPages}
              className='px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-30'>
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
