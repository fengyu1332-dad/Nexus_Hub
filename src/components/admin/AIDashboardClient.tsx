'use client'

import { useState, useCallback } from 'react'
import { Play, RefreshCw, CircleDot, CircleOff, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Workflow {
  id: string
  name: string
  active: boolean
  updatedAt: string
  executions: Array<{
    id: string
    status: string
    startedAt: string
    stoppedAt?: string
  }>
  successCount: number
}

interface AIStat {
  role: string
  postCount: number
}

interface Labels {
  aiDashboard: string
  workflowActive: string
  workflowInactive: string
  executeNow: string
  lastExecution: string
  successRate: string
  activate: string
  deactivate: string
  pipelineConfig: string
  globalCrawlInterval: string
  minutes: string
  nightQuietHours: string
  enabled: string
  disabled: string
  save: string
  n8n: string
  articles: string
  executions: string
  noExecutions: string
  healthy: string
  unhealthy: string
}

export function AIDashboardClient({
  initialWorkflows,
  aiStats,
  pipelineConfig,
  labels,
}: {
  initialWorkflows: Workflow[]
  aiStats: AIStat[]
  pipelineConfig: Record<string, string>
  labels: Labels
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>(initialWorkflows)
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedWf, setExpandedWf] = useState<string | null>(null)
  const [config, setConfig] = useState({
    globalCrawlInterval: JSON.parse(pipelineConfig.global_crawl_interval || '30'),
    nightQuietEnabled: JSON.parse(pipelineConfig.night_quiet_hours || '{}').enabled || false,
    nightStart: JSON.parse(pipelineConfig.night_quiet_hours || '{}').startHour || 0,
    nightEnd: JSON.parse(pipelineConfig.night_quiet_hours || '{}').endHour || 7,
  })
  const [configSaving, setConfigSaving] = useState(false)

  const toggleWorkflow = useCallback(async (wfId: string, activate: boolean) => {
    setLoading(wfId)
    try {
      const res = await fetch(`/api/admin/workflows/${wfId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: activate }),
      })
      if (res.ok) {
        setWorkflows((prev) =>
          prev.map((w) => (w.id === wfId ? { ...w, active: activate } : w))
        )
      }
    } catch { /* */ }
    setLoading(null)
  }, [])

  const executeWorkflow = useCallback(async (wfId: string) => {
    setLoading(wfId)
    try {
      await fetch(`/api/admin/workflows/${wfId}/execute`, { method: 'POST' })
    } catch { /* */ }
    setLoading(null)
  }, [])

  const refreshWorkflows = useCallback(async () => {
    setLoading('refresh')
    try {
      const res = await fetch('/api/admin/workflows')
      if (res.ok) setWorkflows(await res.json())
    } catch { /* */ }
    setLoading(null)
  }, [])

  const saveConfig = useCallback(async () => {
    setConfigSaving(true)
    try {
      await fetch('/api/admin/pipeline-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'global_crawl_interval',
          value: JSON.stringify(config.globalCrawlInterval),
        }),
      })
      await fetch('/api/admin/pipeline-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'night_quiet_hours',
          value: JSON.stringify({
            enabled: config.nightQuietEnabled,
            startHour: config.nightStart,
            endHour: config.nightEnd,
          }),
        }),
      })
    } catch { /* */ }
    setConfigSaving(false)
  }, [config])

  return (
    <div className='space-y-6'>
      {/* ── AI Agent Stats ─────────────────────────── */}
      {aiStats.length > 0 && (
        <div className='grid grid-cols-3 gap-4'>
          {aiStats.map((stat) => (
            <div key={stat.role} className='bg-white border border-zinc-200 rounded-xl p-5'>
              <p className='text-sm text-zinc-500'>{stat.role}</p>
              <p className='text-2xl font-bold text-zinc-900 mt-1'>{stat.postCount}</p>
              <p className='text-xs text-zinc-400 mt-0.5'>{labels.articles}</p>
            </div>
          ))}
          <div className='bg-white border border-zinc-200 rounded-xl p-5'>
            <p className='text-sm text-zinc-500'>{labels.n8n}</p>
            <p className='text-2xl font-bold text-zinc-900 mt-1'>
              {workflows.filter((w) => w.active).length}/{workflows.length}
            </p>
            <p className='text-xs text-zinc-400 mt-0.5'>
              {labels.workflowActive} / {labels.workflowInactive}
            </p>
          </div>
        </div>
      )}

      {/* ── Workflow Cards ─────────────────────────── */}
      <div className='flex items-center justify-between'>
        <h2 className='text-xl font-semibold text-zinc-800'>{labels.executions}</h2>
        <button
          onClick={refreshWorkflows}
          disabled={loading === 'refresh'}
          className='flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50'>
          <RefreshCw className={cn('h-3.5 w-3.5', loading === 'refresh' && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {workflows.length === 0 && (
        <div className='text-center py-12 text-zinc-400'>
          <p>{labels.noExecutions}</p>
          <p className='text-xs mt-1'>Is n8n running and N8N_API_KEY configured?</p>
        </div>
      )}

      <div className='space-y-3'>
        {workflows.map((wf) => (
          <div key={wf.id} className='border border-zinc-200 rounded-xl overflow-hidden'>
            {/* Header */}
            <div className='flex items-center justify-between px-5 py-3.5 bg-zinc-50'>
              <div className='flex items-center gap-3'>
                <button
                  onClick={() => setExpandedWf(expandedWf === wf.id ? null : wf.id)}
                  className='text-zinc-400 hover:text-zinc-600'>
                  {expandedWf === wf.id ? (
                    <ChevronDown className='h-4 w-4' />
                  ) : (
                    <ChevronRight className='h-4 w-4' />
                  )}
                </button>
                <div>
                  <p className='text-sm font-medium text-zinc-800'>{wf.name}</p>
                  <p className='text-xs text-zinc-400'>
                    {labels.lastExecution}:{' '}
                    {wf.executions[0]
                      ? new Date(wf.executions[0].startedAt).toLocaleString('zh-CN')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-2'>
                {/* Status */}
                <span
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                    wf.active
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-zinc-100 text-zinc-500'
                  )}>
                  {wf.active ? <CircleDot className='h-3 w-3' /> : <CircleOff className='h-3 w-3' />}
                  {wf.active ? labels.workflowActive : labels.workflowInactive}
                </span>

                {/* Toggle */}
                <button
                  onClick={() => toggleWorkflow(wf.id, !wf.active)}
                  disabled={loading === wf.id}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50',
                    wf.active
                      ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  )}>
                  {wf.active ? labels.deactivate : labels.activate}
                </button>

                {/* Execute */}
                <button
                  onClick={() => executeWorkflow(wf.id)}
                  disabled={loading === wf.id}
                  className='flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50'>
                  <Play className='h-3 w-3' />
                  {labels.executeNow}
                </button>
              </div>
            </div>

            {/* Expanded: Recent executions */}
            {expandedWf === wf.id && (
              <div className='px-5 py-3 border-t border-zinc-100'>
                {wf.executions.length === 0 ? (
                  <p className='text-sm text-zinc-400'>{labels.noExecutions}</p>
                ) : (
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='text-zinc-400 border-b border-zinc-100'>
                        <th className='text-left py-1.5 font-medium'>Status</th>
                        <th className='text-left py-1.5 font-medium'>Started</th>
                        <th className='text-left py-1.5 font-medium'>Stopped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wf.executions.map((ex) => (
                        <tr key={ex.id} className='border-b border-zinc-50'>
                          <td className='py-1.5'>
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                                ex.status === 'success'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : ex.status === 'error'
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-zinc-100 text-zinc-500'
                              )}>
                              {ex.status}
                            </span>
                          </td>
                          <td className='py-1.5 text-zinc-600'>
                            {new Date(ex.startedAt).toLocaleString('zh-CN')}
                          </td>
                          <td className='py-1.5 text-zinc-400'>
                            {ex.stoppedAt ? new Date(ex.stoppedAt).toLocaleString('zh-CN') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Success rate */}
                {wf.executions.length > 0 && (
                  <div className='flex items-center gap-2 mt-2 text-xs text-zinc-400'>
                    {labels.successRate}:{' '}
                    <span className='font-medium text-zinc-700'>
                      {Math.round((wf.successCount / Math.min(wf.executions.length, 5)) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Pipeline Config ────────────────────────── */}
      <div className='border border-zinc-200 rounded-xl p-5'>
        <div className='flex items-center gap-2 mb-4'>
          <Settings className='h-4 w-4 text-zinc-500' />
          <h3 className='text-lg font-semibold text-zinc-800'>{labels.pipelineConfig}</h3>
        </div>

        <div className='grid grid-cols-2 gap-6'>
          {/* Global crawl interval */}
          <div>
            <label className='block text-sm font-medium text-zinc-700 mb-1.5'>
              {labels.globalCrawlInterval}
            </label>
            <select
              value={config.globalCrawlInterval}
              onChange={(e) => setConfig((c) => ({ ...c, globalCrawlInterval: Number(e.target.value) }))}
              className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'>
              {[15, 30, 60, 120, 180, 360, 720, 1440].map((m) => (
                <option key={m} value={m}>
                  {m} {labels.minutes}
                </option>
              ))}
            </select>
          </div>

          {/* Night quiet hours */}
          <div>
            <label className='block text-sm font-medium text-zinc-700 mb-1.5'>
              {labels.nightQuietHours}
            </label>
            <div className='flex items-center gap-3'>
              <label className='flex items-center gap-1.5 text-sm'>
                <input
                  type='checkbox'
                  checked={config.nightQuietEnabled}
                  onChange={(e) => setConfig((c) => ({ ...c, nightQuietEnabled: e.target.checked }))}
                  className='rounded'
                />
                {labels.enabled}
              </label>
              {config.nightQuietEnabled && (
                <>
                  <input
                    type='number'
                    min={0}
                    max={23}
                    value={config.nightStart}
                    onChange={(e) => setConfig((c) => ({ ...c, nightStart: Number(e.target.value) }))}
                    className='w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm'
                  />
                  <span className='text-sm text-zinc-400'>-</span>
                  <input
                    type='number'
                    min={0}
                    max={23}
                    value={config.nightEnd}
                    onChange={(e) => setConfig((c) => ({ ...c, nightEnd: Number(e.target.value) }))}
                    className='w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm'
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={saveConfig}
          disabled={configSaving}
          className='mt-4 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors'>
          {configSaving ? 'Saving...' : labels.save}
        </button>
      </div>
    </div>
  )
}
