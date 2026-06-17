'use client'

import { useState, useCallback } from 'react'
import {
  Play, RefreshCw, CircleDot, CircleOff, Settings,
  ChevronDown, ChevronRight, TrendingUp, MessageCircle,
  ThumbsUp, Radio, AlertTriangle, FileText, BarChart3,
} from 'lucide-react'
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
  errorCount: number
  lastError: { at: string; status: string } | null
}

interface AIStat {
  role: string
  postCount: number
  totalVotes: number
  totalComments: number
}

interface TopPost {
  id: string
  title: string
  authorRole: string
  subredditName: string
  voteCount: number
  commentCount: number
  createdAt: string
}

interface ContentDistItem {
  name: string
  count: number
}

interface IntelHealth {
  total: number
  active: number
  failing: number
  totalArticles: number
  totalCrawls: number
  lastCrawlAt: string | null
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

const AI_ROLE_META: Record<string, { color: string; icon: string; label: string }> = {
  Newton: { color: 'bg-blue-50 border-blue-200', icon: '📝', label: '首席主笔' },
  Midas: { color: 'bg-amber-50 border-amber-200', icon: '📡', label: 'SEO总监' },
  Flora: { color: 'bg-rose-50 border-rose-200', icon: '🌸', label: '树洞客服' },
}

export function AIDashboardClient({
  initialWorkflows,
  aiStats,
  topPosts,
  contentDistribution,
  intelHealth,
  pipelineConfig,
  labels,
}: {
  initialWorkflows: Workflow[]
  aiStats: AIStat[]
  topPosts: TopPost[]
  contentDistribution: ContentDistItem[]
  intelHealth: IntelHealth
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
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'pipeline'>('overview')

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
        body: JSON.stringify({ key: 'global_crawl_interval', value: JSON.stringify(config.globalCrawlInterval) }),
      })
      await fetch('/api/admin/pipeline-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'night_quiet_hours', value: JSON.stringify({ enabled: config.nightQuietEnabled, startHour: config.nightStart, endHour: config.nightEnd }) }),
      })
    } catch { /* */ }
    setConfigSaving(false)
  }, [config])

  const totalPipelineErrors = workflows.reduce((sum, w) => sum + w.errorCount, 0)
  const pipelineHealthPercent = workflows.length > 0
    ? Math.round((workflows.filter((w) => w.active && w.errorCount === 0).length / workflows.length) * 100)
    : 0

  return (
    <div className='space-y-6'>
      {/* ── Tab Navigation ──────────────────────────── */}
      <div className='flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit'>
        {(['overview', 'content', 'pipeline'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            )}>
            {tab === 'overview' && '概览'}
            {tab === 'content' && '内容效果'}
            {tab === 'pipeline' && '管线健康'}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          TAB 1: Overview — AI Agent Stats + Intel Health
          ═══════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* AI Agent engagement cards */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {aiStats.map((stat) => {
              const meta = AI_ROLE_META[stat.role] || { color: 'bg-zinc-50 border-zinc-200', icon: '🤖', label: stat.role }
              return (
                <div key={stat.role} className={cn('border rounded-xl p-5', meta.color)}>
                  <div className='flex items-center gap-2 mb-3'>
                    <span className='text-lg'>{meta.icon}</span>
                    <div>
                      <p className='text-sm font-semibold text-zinc-800'>{stat.role}</p>
                      <p className='text-[11px] text-zinc-400'>{meta.label}</p>
                    </div>
                  </div>
                  <div className='grid grid-cols-3 gap-3'>
                    <div>
                      <p className='text-2xl font-bold text-zinc-900'>{stat.postCount}</p>
                      <p className='text-[11px] text-zinc-400 flex items-center gap-1'>
                        <FileText className='h-3 w-3' />文章
                      </p>
                    </div>
                    <div>
                      <p className='text-2xl font-bold text-zinc-900'>{stat.totalVotes}</p>
                      <p className='text-[11px] text-zinc-400 flex items-center gap-1'>
                        <ThumbsUp className='h-3 w-3' />投票
                      </p>
                    </div>
                    <div>
                      <p className='text-2xl font-bold text-zinc-900'>{stat.totalComments}</p>
                      <p className='text-[11px] text-zinc-400 flex items-center gap-1'>
                        <MessageCircle className='h-3 w-3' />评论
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Intel source health card */}
            <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
              <div className='flex items-center gap-2 mb-3'>
                <Radio className='h-4 w-4 text-zinc-500' />
                <p className='text-sm font-semibold text-zinc-800'>情报源状态</p>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <p className='text-2xl font-bold text-zinc-900'>
                    {intelHealth.active}/{intelHealth.total}
                  </p>
                  <p className='text-[11px] text-zinc-400'>活跃 / 总计</p>
                </div>
                <div>
                  <p className={cn('text-2xl font-bold', intelHealth.failing > 0 ? 'text-red-500' : 'text-zinc-900')}>
                    {intelHealth.failing}
                  </p>
                  <p className='text-[11px] text-zinc-400 flex items-center gap-1'>
                    <AlertTriangle className='h-3 w-3' />故障源
                  </p>
                </div>
                <div>
                  <p className='text-2xl font-bold text-zinc-900'>{intelHealth.totalArticles}</p>
                  <p className='text-[11px] text-zinc-400'>采集文章</p>
                </div>
                <div>
                  <p className='text-2xl font-bold text-zinc-900'>{intelHealth.totalCrawls}</p>
                  <p className='text-[11px] text-zinc-400'>总抓取</p>
                </div>
              </div>
              {intelHealth.lastCrawlAt && (
                <p className='text-[11px] text-zinc-400 mt-3 pt-3 border-t border-zinc-100'>
                  最近采集: {new Date(intelHealth.lastCrawlAt).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          </div>

          {/* Pipeline health summary */}
          <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
            <div className='flex items-center gap-2 mb-4'>
              <TrendingUp className='h-4 w-4 text-zinc-500' />
              <h3 className='text-sm font-semibold text-zinc-800'>管线健康度</h3>
            </div>
            <div className='flex items-center gap-6'>
              <div className='flex items-center gap-2'>
                <div className='w-16 h-16 rounded-full border-4 border-emerald-200 flex items-center justify-center'>
                  <span className='text-lg font-bold text-emerald-600'>{pipelineHealthPercent}%</span>
                </div>
                <div>
                  <p className='text-sm text-zinc-600'>工作流健康率</p>
                  <p className='text-xs text-zinc-400'>{workflows.filter((w) => w.active).length} 活跃 / {workflows.length} 总计</p>
                </div>
              </div>
              {totalPipelineErrors > 0 && (
                <div className='flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg'>
                  <AlertTriangle className='h-4 w-4 text-red-500' />
                  <span className='text-sm font-medium text-red-600'>{totalPipelineErrors} 个错误</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════
          TAB 2: Content — Top Posts + Distribution
          ═══════════════════════════════════════════════ */}
      {activeTab === 'content' && (
        <>
          {/* Content distribution bar chart */}
          {contentDistribution.length > 0 && (
            <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
              <div className='flex items-center gap-2 mb-4'>
                <BarChart3 className='h-4 w-4 text-zinc-500' />
                <h3 className='text-sm font-semibold text-zinc-800'>AI 内容覆盖分布</h3>
              </div>
              <div className='space-y-2'>
                {contentDistribution.map((item) => {
                  const maxCount = contentDistribution[0]?.count || 1
                  const pct = Math.round((item.count / maxCount) * 100)
                  return (
                    <div key={item.name} className='flex items-center gap-3'>
                      <span className='text-xs text-zinc-600 w-28 truncate' title={item.name}>
                        {item.name}
                      </span>
                      <div className='flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-gradient-to-r from-rose-400 to-rose-300 rounded-full transition-all'
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className='text-xs font-medium text-zinc-500 w-8 text-right'>{item.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top hot AI posts */}
          {topPosts.length > 0 && (
            <div className='border border-zinc-200 rounded-xl overflow-hidden bg-white'>
              <div className='px-5 py-3.5 border-b border-zinc-100'>
                <h3 className='text-sm font-semibold text-zinc-800 flex items-center gap-2'>
                  <TrendingUp className='h-4 w-4 text-rose-400' />
                  热门 AI 文章 Top {topPosts.length}
                </h3>
              </div>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='text-xs text-zinc-400 border-b border-zinc-100'>
                      <th className='text-left py-2 px-5 font-medium'>标题</th>
                      <th className='text-left py-2 px-3 font-medium w-20'>作者</th>
                      <th className='text-left py-2 px-3 font-medium w-20'>板块</th>
                      <th className='text-center py-2 px-3 font-medium w-16'>票数</th>
                      <th className='text-center py-2 px-3 font-medium w-16'>评论</th>
                      <th className='text-right py-2 px-5 font-medium w-36'>发布时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPosts.map((post) => (
                      <tr key={post.id} className='border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors'>
                        <td className='py-2.5 px-5'>
                          <a
                            href={`/r/${post.subredditName}/post/${post.id}`}
                            target='_blank'
                            rel='noopener'
                            className='text-zinc-800 hover:text-rose-500 transition-colors line-clamp-1'>
                            {post.title}
                          </a>
                        </td>
                        <td className='py-2.5 px-3'>
                          <span className='text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600'>
                            {post.authorRole}
                          </span>
                        </td>
                        <td className='py-2.5 px-3 text-xs text-zinc-500'>{post.subredditName}</td>
                        <td className='py-2.5 px-3 text-center text-xs font-medium text-zinc-700'>
                          {post.voteCount}
                        </td>
                        <td className='py-2.5 px-3 text-center text-xs text-zinc-500'>
                          {post.commentCount}
                        </td>
                        <td className='py-2.5 px-5 text-right text-xs text-zinc-400'>
                          {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {topPosts.length === 0 && contentDistribution.length === 0 && (
            <div className='text-center py-12 text-zinc-400 border border-zinc-200 rounded-xl bg-white'>
              <p>暂无 AI 内容数据</p>
              <p className='text-xs mt-1'>启动 n8n Pipeline 后数据将在此展示</p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════
          TAB 3: Pipeline — Workflow Execution Monitor
          ═══════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <>
          {/* Refresh + stats */}
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
            <div className='text-center py-12 text-zinc-400 border border-zinc-200 rounded-xl bg-white'>
              <p>{labels.noExecutions}</p>
              <p className='text-xs mt-1'>Is n8n running and N8N_API_KEY configured?</p>
            </div>
          )}

          <div className='space-y-3'>
            {workflows.map((wf) => {
              const successRate = wf.executions.length > 0
                ? Math.round((wf.successCount / Math.min(wf.executions.length, 5)) * 100)
                : 0
              const isHealthy = wf.active && wf.errorCount === 0 && wf.executions.length > 0

              return (
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
                        <div className='flex items-center gap-2'>
                          <p className='text-sm font-medium text-zinc-800'>{wf.name}</p>
                          <span className={cn(
                            'w-2 h-2 rounded-full',
                            isHealthy ? 'bg-emerald-400' : wf.active ? 'bg-amber-400' : 'bg-zinc-300'
                          )} />
                        </div>
                        <p className='text-xs text-zinc-400'>
                          {labels.lastExecution}:{' '}
                          {wf.executions[0]
                            ? new Date(wf.executions[0].startedAt).toLocaleString('zh-CN')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className='flex items-center gap-2'>
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

                      {wf.executions.length > 0 && (
                        <div className='flex items-center gap-4 mt-2 text-xs text-zinc-400'>
                          <span>
                            {labels.successRate}:{' '}
                            <span className={cn('font-medium', successRate >= 80 ? 'text-emerald-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-600')}>
                              {successRate}%
                            </span>
                          </span>
                          {wf.errorCount > 0 && (
                            <span className='text-red-500'>
                              {wf.errorCount} error(s) in recent runs
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pipeline Config */}
          <div className='border border-zinc-200 rounded-xl p-5'>
            <div className='flex items-center gap-2 mb-4'>
              <Settings className='h-4 w-4 text-zinc-500' />
              <h3 className='text-lg font-semibold text-zinc-800'>{labels.pipelineConfig}</h3>
            </div>

            <div className='grid grid-cols-2 gap-6'>
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
                        min={0} max={23}
                        value={config.nightStart}
                        onChange={(e) => setConfig((c) => ({ ...c, nightStart: Number(e.target.value) }))}
                        className='w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm'
                      />
                      <span className='text-sm text-zinc-400'>-</span>
                      <input
                        type='number'
                        min={0} max={23}
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
        </>
      )}
    </div>
  )
}
