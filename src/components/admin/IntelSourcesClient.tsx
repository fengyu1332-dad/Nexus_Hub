'use client'

import { useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, FlaskConical, X, ExternalLink,
  CircleDot, CircleOff, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Source {
  id: string
  label: string
  url: string
  type: 'rss' | 'webpage'
  category: string | null
  priority: 'high' | 'medium' | 'low'
  crawlInterval: number
  isActive: boolean
  contentSelector: string | null
  consecutiveFailures: number
  maxFailures: number
  lastCrawlAt: string | null
  lastError: string | null
  crawlCount: number
  articleCount: number
  recentLogs: Array<{
    id: string
    status: string
    title: string | null
    contentLength: number | null
    duration: number | null
    errorMessage: string | null
    createdAt: string
  }>
}

interface Labels {
  intelSources: string
  addSource: string
  editSource: string
  label: string
  url: string
  type: string
  rss: string
  webpage: string
  category: string
  priority: string
  crawlInterval: string
  minutes: string
  contentSelector: string
  active: string
  inactive: string
  testCrawl: string
  testResult: string
  preview: string
  save: string
  delete: string
  lastCrawl: string
  articleCount: string
  crawlCount: string
  crawlLogs: string
  noLogs: string
  circuitBreaker: string
  resetCircuitBreaker: string
  duration: string
  contentLength: string
  successRate: string
  healthy: string
  unhealthy: string
}

interface SourceForm {
  label: string
  url: string
  type: 'rss' | 'webpage'
  category: string
  priority: 'high' | 'medium' | 'low'
  crawlInterval: number
  isActive: boolean
  contentSelector: string
}

const emptyForm: SourceForm = {
  label: '',
  url: '',
  type: 'webpage',
  category: '',
  priority: 'medium',
  crawlInterval: 30,
  isActive: true,
  contentSelector: '',
}

export function IntelSourcesClient({
  initialSources,
  labels,
}: {
  initialSources: Source[]
  labels: Labels
}) {
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<SourceForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Test crawl state
  const [testResult, setTestResult] = useState<any>(null)
  const [testLoading, setTestLoading] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setForm(emptyForm)
    setEditId(null)
    setShowForm(false)
  }, [])

  const openEdit = useCallback((s: Source) => {
    setForm({
      label: s.label,
      url: s.url,
      type: s.type,
      category: s.category || '',
      priority: s.priority,
      crawlInterval: s.crawlInterval,
      isActive: s.isActive,
      contentSelector: s.contentSelector || '',
    })
    setEditId(s.id)
    setShowForm(true)
  }, [])

  const saveSource = useCallback(async () => {
    setSaving(true)
    try {
      const payload = {
        ...form,
        category: form.category || null,
        contentSelector: form.contentSelector || null,
      }

      if (editId) {
        const res = await fetch(`/api/admin/intel-sources/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const updated = await res.json()
          setSources((prev) => prev.map((s) => (s.id === editId ? { ...s, ...updated } : s)))
          resetForm()
        }
      } else {
        const res = await fetch('/api/admin/intel-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const created = await res.json()
          setSources((prev) => [...prev, { ...created, recentLogs: [] }])
          resetForm()
        }
      }
    } catch { /* */ }
    setSaving(false)
  }, [form, editId, resetForm])

  const deleteSource = useCallback(async (id: string) => {
    if (!confirm('Are you sure? This will also delete all crawl logs for this source.')) return
    try {
      await fetch(`/api/admin/intel-sources/${id}`, { method: 'DELETE' })
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch { /* */ }
  }, [])

  const toggleSource = useCallback(async (id: string, active: boolean) => {
    try {
      await fetch(`/api/admin/intel-sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active }),
      })
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: active } : s)))
    } catch { /* */ }
  }, [])

  const resetCircuitBreaker = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/intel-sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consecutiveFailures: 0, lastError: null, isActive: true }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)))
      }
    } catch { /* */ }
  }, [])

  const testCrawl = useCallback(async (id: string) => {
    setTestLoading(id)
    setTestResult(null)
    try {
      const res = await fetch(`/api/admin/intel-sources/${id}/test`, { method: 'POST' })
      const result = await res.json()
      setTestResult(result)
    } catch { /* */ }
    setTestLoading(null)
  }, [])

  const priorityBadge = (p: string) => {
    switch (p) {
      case 'high':
        return <span className='px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-600'>HIGH</span>
      case 'medium':
        return <span className='px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600'>MED</span>
      case 'low':
        return <span className='px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500'>LOW</span>
    }
  }

  return (
    <div className='space-y-4'>
      {/* Add button */}
      <div className='flex items-center justify-between'>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className='flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors'>
          <Plus className='h-4 w-4' />
          {labels.addSource}
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white rounded-2xl shadow-2xl w-[520px] max-h-[90vh] overflow-y-auto p-6'>
            <div className='flex items-center justify-between mb-5'>
              <h3 className='text-lg font-semibold text-zinc-800'>
                {editId ? labels.editSource : labels.addSource}
              </h3>
              <button onClick={resetForm} className='text-zinc-400 hover:text-zinc-600'>
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-zinc-700 mb-1'>{labels.label}</label>
                <input
                  type='text'
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
                  placeholder='Guardian Education'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-zinc-700 mb-1'>{labels.url}</label>
                <input
                  type='url'
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
                  placeholder='https://...'
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-zinc-700 mb-1'>{labels.type}</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'rss' | 'webpage' }))}
                    className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm'>
                    <option value='webpage'>{labels.webpage}</option>
                    <option value='rss'>{labels.rss}</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-zinc-700 mb-1'>{labels.priority}</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                    className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm'>
                    <option value='high'>High</option>
                    <option value='medium'>Medium</option>
                    <option value='low'>Low</option>
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-zinc-700 mb-1'>{labels.crawlInterval}</label>
                  <div className='flex items-center gap-2'>
                    <input
                      type='number'
                      min={5}
                      value={form.crawlInterval}
                      onChange={(e) => setForm((f) => ({ ...f, crawlInterval: Number(e.target.value) }))}
                      className='w-20 rounded-lg border border-zinc-300 px-3 py-2 text-sm'
                    />
                    <span className='text-sm text-zinc-400'>{labels.minutes}</span>
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-zinc-700 mb-1'>{labels.category}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm'>
                    <option value=''>--</option>
                    <option value='admissions'>Admissions</option>
                    <option value='exams'>Exams</option>
                    <option value='rankings'>Rankings</option>
                    <option value='general'>General</option>
                  </select>
                </div>
              </div>

              {form.type === 'webpage' && (
                <div>
                  <label className='block text-sm font-medium text-zinc-700 mb-1'>
                    {labels.contentSelector} <span className='text-zinc-400 font-normal'>(optional)</span>
                  </label>
                  <input
                    type='text'
                    value={form.contentSelector}
                    onChange={(e) => setForm((f) => ({ ...f, contentSelector: e.target.value }))}
                    className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono'
                    placeholder='article, .article-body, main'
                  />
                </div>
              )}

              <label className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className='rounded'
                />
                {form.isActive ? labels.active : labels.inactive}
              </label>
            </div>

            <div className='flex justify-end gap-2 mt-6'>
              <button
                onClick={resetForm}
                className='px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors'>
                Cancel
              </button>
              <button
                onClick={saveSource}
                disabled={saving || !form.label || !form.url}
                className='px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors'>
                {saving ? 'Saving...' : labels.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test crawl result modal */}
      {testResult && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='bg-white rounded-2xl shadow-2xl w-[520px] max-h-[80vh] overflow-y-auto p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-zinc-800'>{labels.testResult}</h3>
              <button onClick={() => setTestResult(null)} className='text-zinc-400 hover:text-zinc-600'>
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='space-y-3 text-sm'>
              <div className='flex items-center gap-2'>
                <span className='text-zinc-500'>Status:</span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-medium',
                  testResult.status === 'success'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                )}>
                  {testResult.status}
                </span>
                <span className='text-zinc-400 text-xs'>
                  ({testResult.duration}ms)
                </span>
              </div>

              {testResult.title && (
                <div>
                  <span className='text-zinc-500'>Title:</span>
                  <p className='mt-0.5 text-zinc-800 font-medium'>{testResult.title}</p>
                </div>
              )}

              {testResult.contentLength && (
                <div>
                  <span className='text-zinc-500'>{labels.contentLength}:</span>
                  <span className='ml-1 text-zinc-700'>{testResult.contentLength.toLocaleString()} chars</span>
                </div>
              )}

              {testResult.contentPreview && (
                <div>
                  <p className='text-zinc-500 mb-1'>{labels.preview}:</p>
                  <pre className='bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-xs text-zinc-600 whitespace-pre-wrap max-h-48 overflow-y-auto'>
                    {testResult.contentPreview}
                  </pre>
                </div>
              )}

              {testResult.error && (
                <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600'>
                  {testResult.error}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source table */}
      <div className='overflow-hidden rounded-xl border border-zinc-200'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-zinc-50 border-b border-zinc-200'>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'></th>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'>{labels.label}</th>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'>{labels.type}</th>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'>{labels.priority}</th>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'>{labels.crawlInterval}</th>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'>Status</th>
              <th className='text-left px-4 py-3 font-medium text-zinc-600'>{labels.lastCrawl}</th>
              <th className='text-right px-4 py-3 font-medium text-zinc-600'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 && (
              <tr>
                <td colSpan={8} className='text-center py-12 text-zinc-400'>
                  {labels.noLogs}
                </td>
              </tr>
            )}
            {sources.map((source) => (
              <>
                <tr key={source.id} className='border-b border-zinc-100 hover:bg-zinc-50/50'>
                  <td className='px-4 py-3'>
                    <button
                      onClick={() => setExpandedId(expandedId === source.id ? null : source.id)}
                      className='text-zinc-400 hover:text-zinc-600'>
                      {expandedId === source.id ? (
                        <ChevronDown className='h-4 w-4' />
                      ) : (
                        <ChevronRight className='h-4 w-4' />
                      )}
                    </button>
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium text-zinc-800'>{source.label}</span>
                      {source.consecutiveFailures >= source.maxFailures && (
                        <AlertTriangle className='h-3.5 w-3.5 text-red-500' title={labels.circuitBreaker} />
                      )}
                    </div>
                    <a
                      href={source.url}
                      target='_blank'
                      rel='noopener'
                      className='text-xs text-zinc-400 hover:text-rose-500 truncate max-w-[200px] inline-block'>
                      {source.url}
                    </a>
                  </td>
                  <td className='px-4 py-3'>
                    <span className='text-xs px-1.5 py-0.5 bg-zinc-100 rounded text-zinc-600'>
                      {source.type === 'rss' ? labels.rss : labels.webpage}
                    </span>
                  </td>
                  <td className='px-4 py-3'>{priorityBadge(source.priority)}</td>
                  <td className='px-4 py-3 text-zinc-600'>
                    {source.crawlInterval}{labels.minutes}
                  </td>
                  <td className='px-4 py-3'>
                    <button
                      onClick={() => toggleSource(source.id, !source.isActive)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                        source.isActive
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      )}>
                      {source.isActive ? <CircleDot className='h-3 w-3' /> : <CircleOff className='h-3 w-3' />}
                      {source.isActive ? labels.active : labels.inactive}
                    </button>
                  </td>
                  <td className='px-4 py-3 text-xs text-zinc-400'>
                    {source.lastCrawlAt
                      ? new Date(source.lastCrawlAt).toLocaleString('zh-CN')
                      : '-'}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center justify-end gap-1'>
                      <button
                        onClick={() => testCrawl(source.id)}
                        disabled={testLoading === source.id}
                        className='p-1.5 rounded hover:bg-purple-50 text-purple-500 transition-colors disabled:opacity-50'
                        title={labels.testCrawl}>
                        {testLoading === source.id ? (
                          <span className='animate-spin inline-block h-3.5 w-3.5 border-2 border-purple-300 border-t-purple-500 rounded-full' />
                        ) : (
                          <FlaskConical className='h-3.5 w-3.5' />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(source)}
                        className='p-1.5 rounded hover:bg-zinc-100 text-zinc-500 transition-colors'
                        title={labels.editSource}>
                        <Pencil className='h-3.5 w-3.5' />
                      </button>
                      <button
                        onClick={() => deleteSource(source.id)}
                        className='p-1.5 rounded hover:bg-red-50 text-red-400 transition-colors'
                        title={labels.delete}>
                        <Trash2 className='h-3.5 w-3.5' />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded row: recent logs + circuit breaker info */}
                {expandedId === source.id && (
                  <tr key={`${source.id}-logs`}>
                    <td colSpan={8} className='px-4 py-3 bg-zinc-50/50 border-b border-zinc-100'>
                      {/* Circuit breaker warning */}
                      {source.consecutiveFailures >= source.maxFailures && (
                        <div className='flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-3'>
                          <AlertTriangle className='h-4 w-4 text-red-500' />
                          <span className='text-sm text-red-600'>
                            {labels.circuitBreaker}: {source.consecutiveFailures} consecutive failures
                            ({source.lastError})
                          </span>
                          <button
                            onClick={() => resetCircuitBreaker(source.id)}
                            className='ml-auto px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors'>
                            {labels.resetCircuitBreaker}
                          </button>
                        </div>
                      )}

                      {/* Stats */}
                      <div className='flex gap-6 mb-3 text-xs text-zinc-500'>
                        <span>{labels.crawlCount}: <strong className='text-zinc-700'>{source.crawlCount}</strong></span>
                        <span>{labels.articleCount}: <strong className='text-zinc-700'>{source.articleCount}</strong></span>
                        {source.recentLogs.length > 0 && (
                          <span>
                            {labels.successRate}:{' '}
                            <strong className='text-zinc-700'>
                              {Math.round(
                                (source.recentLogs.filter((l) => l.status === 'success').length /
                                  Math.min(source.recentLogs.length, 5)) *
                                  100
                              )}%
                            </strong>
                          </span>
                        )}
                      </div>

                      {/* Recent logs table */}
                      <h4 className='text-xs font-medium text-zinc-600 mb-2'>{labels.crawlLogs}</h4>
                      {source.recentLogs.length === 0 ? (
                        <p className='text-xs text-zinc-400'>{labels.noLogs}</p>
                      ) : (
                        <table className='w-full text-xs'>
                          <thead>
                            <tr className='text-zinc-400'>
                              <th className='text-left py-1 font-medium'>Status</th>
                              <th className='text-left py-1 font-medium'>Title</th>
                              <th className='text-left py-1 font-medium'>{labels.contentLength}</th>
                              <th className='text-left py-1 font-medium'>{labels.duration}</th>
                              <th className='text-left py-1 font-medium'>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {source.recentLogs.map((log) => (
                              <tr key={log.id} className='border-t border-zinc-100'>
                                <td className='py-1.5'>
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                      log.status === 'success'
                                        ? 'bg-emerald-50 text-emerald-600'
                                        : log.status === 'deduplicated'
                                        ? 'bg-amber-50 text-amber-600'
                                        : 'bg-red-50 text-red-600'
                                    )}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className='py-1.5 text-zinc-600 max-w-[200px] truncate'>
                                  {log.title || '-'}
                                </td>
                                <td className='py-1.5 text-zinc-400'>
                                  {log.contentLength ? `${log.contentLength}` : '-'}
                                </td>
                                <td className='py-1.5 text-zinc-400'>
                                  {log.duration ? `${log.duration}ms` : '-'}
                                </td>
                                <td className='py-1.5 text-zinc-400'>
                                  {new Date(log.createdAt).toLocaleString('zh-CN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
