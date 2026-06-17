'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Plus, Check, History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptVersionEditorProps {
  labels: {
    title: string
    agentRole: string
    promptName: string
    version: string
    active: string
    setActive: string
    newVersion: string
    changeNotes: string
    history: string
  }
}

export function PromptVersionEditor({ labels }: PromptVersionEditorProps) {
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<string>('Newton')
  const [showNewForm, setShowNewForm] = useState(false)
  const [form, setForm] = useState({ promptName: '', content: '', changeNotes: '', setActive: true })

  const { data: versionsData, isLoading } = useQuery({
    queryKey: ['prompt-versions', selectedRole],
    queryFn: async () => {
      const res = await axios.get(`/api/admin/prompt-versions?agentRole=${selectedRole}`)
      return res.data.versions || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      await axios.post('/api/admin/prompt-versions', {
        agentRole: selectedRole,
        ...data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-versions', selectedRole] })
      setShowNewForm(false)
      setForm({ promptName: '', content: '', changeNotes: '', setActive: true })
    },
  })

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await axios.put('/api/admin/prompt-versions', { id, isActive })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-versions', selectedRole] })
    },
  })

  const versions = versionsData || []

  return (
    <div className='bg-white rounded-lg border border-zinc-200 p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold text-zinc-900'>{labels.title}</h3>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className='text-sm border border-zinc-200 rounded px-3 py-1.5 bg-white'>
          <option value='Newton'>Newton 学长</option>
          <option value='Midas'>Midas SEO</option>
          <option value='Flora'>Flora 学姐</option>
        </select>
      </div>

      {isLoading ? (
        <div className='text-sm text-zinc-400 py-4'>Loading...</div>
      ) : versions.length === 0 ? (
        <div className='text-sm text-zinc-400 py-4'>暂无版本，创建一个吧</div>
      ) : (
        <div className='space-y-3 mb-4'>
          {versions.map((v: any) => (
            <div
              key={v.id}
              className={cn(
                'border rounded-lg p-4 transition-colors',
                v.isActive ? 'border-emerald-300 bg-emerald-50/30' : 'border-zinc-200'
              )}>
              <div className='flex items-center justify-between mb-2'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium text-zinc-800'>{v.promptName}</span>
                  <span className='text-xs text-zinc-400'>
                    {labels.version} {v.version}
                  </span>
                  {v.isActive && (
                    <span className='text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium'>
                      {labels.active}
                    </span>
                  )}
                </div>
                {!v.isActive && (
                  <button
                    onClick={() => setActiveMutation.mutate({ id: v.id, isActive: true })}
                    className='text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1'>
                    <Check className='h-3 w-3' />
                    {labels.setActive}
                  </button>
                )}
              </div>
              <pre className='text-xs text-zinc-600 bg-zinc-50 rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap'>
                {v.content}
              </pre>
              {v.changeNotes && (
                <p className='text-xs text-zinc-400 mt-2'>{v.changeNotes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showNewForm ? (
        <div className='border border-violet-200 rounded-lg p-4 space-y-3'>
          <input
            type='text'
            value={form.promptName}
            onChange={(e) => setForm({ ...form, promptName: e.target.value })}
            placeholder='Prompt 名称 (如 main, enhanced_v2)'
            className='w-full text-sm px-3 py-2 border border-zinc-200 rounded focus:outline-none focus:border-violet-300'
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder='Prompt 内容...'
            rows={8}
            className='w-full text-sm px-3 py-2 border border-zinc-200 rounded focus:outline-none focus:border-violet-300 font-mono'
          />
          <input
            type='text'
            value={form.changeNotes}
            onChange={(e) => setForm({ ...form, changeNotes: e.target.value })}
            placeholder='修改说明（可选）'
            className='w-full text-sm px-3 py-2 border border-zinc-200 rounded focus:outline-none focus:border-violet-300'
          />
          <div className='flex items-center gap-3'>
            <label className='flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer'>
              <input
                type='checkbox'
                checked={form.setActive}
                onChange={(e) => setForm({ ...form, setActive: e.target.checked })}
                className='rounded'
              />
              创建后立即生效
            </label>
            <div className='flex-1' />
            <button
              onClick={() => setShowNewForm(false)}
              className='text-sm text-zinc-500 hover:text-zinc-700 px-3 py-1.5'>
              取消
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.promptName || !form.content || createMutation.isLoading}
              className='text-sm bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 px-4 py-1.5 rounded transition-colors'>
              创建
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className='flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 transition-colors'>
          <Plus className='h-4 w-4' />
          {labels.newVersion}
        </button>
      )}
    </div>
  )
}
