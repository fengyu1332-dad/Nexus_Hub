'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Search, Trash2, Pencil, Check, X, Plus } from 'lucide-react'

interface Tag {
  id: string
  name: string
  slug: string
  category: string | null
  postCount: number
}

interface TagManagerProps {
  initialTags: Tag[]
  labels: {
    tags: string
    tagName: string
    tagSlug: string
    tagCategory: string
    postCount: string
    addTag: string
    removeTag: string
    mergeTags: string
    search: string
  }
}

export function TagManager({ initialTags, labels }: TagManagerProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '' })
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', slug: '', category: '' })

  const { data: tagsData } = useQuery({
    queryKey: ['admin-tags', search],
    queryFn: async () => {
      const res = await axios.get(`/api/tags${search ? `?query=${encodeURIComponent(search)}` : ''}`)
      return res.data.tags || []
    },
    initialData: initialTags,
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (tagId: string) => {
      await axios.delete(`/api/admin/tags/${tagId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tags'] }),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      await axios.put(`/api/admin/tags/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] })
      setEditingId(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof newForm) => {
      await axios.post('/api/admin/tags', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] })
      setShowNew(false)
      setNewForm({ name: '', slug: '', category: '' })
    },
  })

  const tags = tagsData || []

  return (
    <div className='bg-white rounded-lg border border-zinc-200'>
      <div className='p-4 border-b border-zinc-100 flex items-center justify-between'>
        <h2 className='font-semibold text-zinc-900'>{labels.tags}</h2>
        <div className='flex items-center gap-3'>
          <div className='relative'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={labels.search}
              className='text-sm pl-8 pr-3 py-1.5 border border-zinc-200 rounded focus:outline-none focus:border-violet-300 w-48'
            />
          </div>
          <button
            onClick={() => setShowNew(true)}
            className='flex items-center gap-1 text-sm bg-violet-600 text-white hover:bg-violet-700 px-3 py-1.5 rounded transition-colors'>
            <Plus className='h-4 w-4' />
            {labels.addTag}
          </button>
        </div>
      </div>

      {showNew && (
        <div className='p-4 border-b border-zinc-100 bg-violet-50/30 flex items-center gap-3'>
          <input
            type='text'
            value={newForm.name}
            onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            placeholder={labels.tagName}
            className='text-sm px-3 py-1.5 border border-zinc-200 rounded flex-1'
          />
          <input
            type='text'
            value={newForm.slug}
            onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })}
            placeholder={labels.tagSlug}
            className='text-sm px-3 py-1.5 border border-zinc-200 rounded w-40'
          />
          <input
            type='text'
            value={newForm.category}
            onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
            placeholder={labels.tagCategory}
            className='text-sm px-3 py-1.5 border border-zinc-200 rounded w-32'
          />
          <button
            onClick={() => createMutation.mutate(newForm)}
            disabled={!newForm.name || createMutation.isLoading}
            className='text-sm bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50'>
            <Check className='h-4 w-4' />
          </button>
          <button
            onClick={() => setShowNew(false)}
            className='text-sm text-zinc-400 hover:text-zinc-600 p-1.5'>
            <X className='h-4 w-4' />
          </button>
        </div>
      )}

      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead className='bg-zinc-50'>
            <tr>
              <th className='text-left px-4 py-2.5 font-medium text-zinc-600'>{labels.tagName}</th>
              <th className='text-left px-4 py-2.5 font-medium text-zinc-600'>{labels.tagSlug}</th>
              <th className='text-left px-4 py-2.5 font-medium text-zinc-600'>{labels.tagCategory}</th>
              <th className='text-right px-4 py-2.5 font-medium text-zinc-600'>{labels.postCount}</th>
              <th className='text-right px-4 py-2.5 font-medium text-zinc-600'></th>
            </tr>
          </thead>
          <tbody>
            {tags.map((tag: Tag) => (
              <tr key={tag.id} className='border-t border-zinc-50 hover:bg-zinc-50/50'>
                <td className='px-4 py-2.5'>
                  {editingId === tag.id ? (
                    <input
                      type='text'
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className='text-sm px-2 py-1 border border-violet-200 rounded w-full'
                      autoFocus
                    />
                  ) : (
                    <span className='font-medium text-zinc-800'>{tag.name}</span>
                  )}
                </td>
                <td className='px-4 py-2.5 text-zinc-500 font-mono text-xs'>{tag.slug}</td>
                <td className='px-4 py-2.5'>
                  {editingId === tag.id ? (
                    <input
                      type='text'
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className='text-sm px-2 py-1 border border-violet-200 rounded w-full'
                    />
                  ) : (
                    <span className='text-zinc-500'>{tag.category || '—'}</span>
                  )}
                </td>
                <td className='px-4 py-2.5 text-right text-zinc-600'>{tag.postCount}</td>
                <td className='px-4 py-2.5 text-right'>
                  {editingId === tag.id ? (
                    <div className='flex items-center justify-end gap-1'>
                      <button
                        onClick={() => updateMutation.mutate({ id: tag.id, data: editForm })}
                        className='p-1 text-emerald-600 hover:bg-emerald-50 rounded'>
                        <Check className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className='p-1 text-zinc-400 hover:bg-zinc-100 rounded'>
                        <X className='h-4 w-4' />
                      </button>
                    </div>
                  ) : (
                    <div className='flex items-center justify-end gap-1'>
                      <button
                        onClick={() => {
                          setEditingId(tag.id)
                          setEditForm({ name: tag.name, category: tag.category || '' })
                        }}
                        className='p-1 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 rounded'>
                        <Pencil className='h-4 w-4' />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete tag "${tag.name}"?`)) {
                            deleteMutation.mutate(tag.id)
                          }
                        }}
                        className='p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded'>
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
