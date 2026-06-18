'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts'
import { TrendingUp, TrendingDown, ThumbsUp, ThumbsDown, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────

interface OverviewData {
  totalPosts: number
  totalComments: number
  totalUsers: number
  totalCommunities: number
  thisWeekPosts: number
  thisWeekComments: number
  thisWeekVotes: number
  activeAgents: number
  totalAgents: number
}

interface VolumePoint {
  date: string
  count: number
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

interface TagDistItem {
  name: string
  count: number
}

interface AgentPerfItem {
  agentId: string
  username: string
  aiRole: string
  totalPosts: number
  totalVotes: number
  recentPosts: number
  helpfulCount: number
  notHelpfulCount: number
  helpfulRatio: number
  avgVotesPerPost: number
}

interface PipelineAggregate {
  total: number
  totalSuccess: number
  overallSuccessRate: number
  byType: { pipelineType: string; total: number; success: number; failed: number; dead: number; successRate: number }[]
}

// ── Constants ──────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Newton: '#3b82f6',
  Midas: '#f59e0b',
  Flora: '#ec4899',
}

const TAG_COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b']

// ── Helper ─────────────────────────────────────────

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Main Component ─────────────────────────────────

export function AnalyticsCharts() {
  const [tab, setTab] = useState<'overview' | 'volume' | 'tags' | 'agents'>('overview')
  const [loading, setLoading] = useState(true)

  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [postVolume, setPostVolume] = useState<VolumePoint[]>([])
  const [topPosts, setTopPosts] = useState<TopPost[]>([])
  const [tagDist, setTagDist] = useState<TagDistItem[]>([])
  const [agentPerf, setAgentPerf] = useState<AgentPerfItem[]>([])
  const [pipelineAgg, setPipelineAgg] = useState<PipelineAggregate | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, volumeRes, topRes, tagRes, agentRes, pipelineRes] = await Promise.all([
        fetch('/api/admin/analytics?metric=overview').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics?metric=post_volume&days=30').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics?metric=top_posts&days=30&limit=10').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics?metric=tag_distribution').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics?metric=agent_performance').then(r => r.ok ? r.json() : null),
        fetch('/api/admin/analytics?metric=pipeline_aggregate').then(r => r.ok ? r.json() : null),
      ])
      if (overviewRes) setOverview(overviewRes)
      if (volumeRes) setPostVolume(volumeRes)
      if (topRes) setTopPosts(topRes)
      if (tagRes) setTagDist(tagRes)
      if (agentRes?.agents) setAgentPerf(agentRes.agents)
      if (pipelineRes) setPipelineAgg(pipelineRes)
    } catch { /* */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 60s
  useEffect(() => {
    const timer = setInterval(fetchData, 60000)
    return () => clearInterval(timer)
  }, [fetchData])

  if (loading && !overview) {
    return (
      <div className='flex items-center justify-center py-16 text-zinc-400'>
        <div className='animate-spin h-6 w-6 border-2 border-zinc-300 border-t-rose-400 rounded-full mr-3' />
        Loading analytics...
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* ── Tab bar ─────────────────────────── */}
      <div className='flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit'>
        {[
          { key: 'overview', label: '概览' },
          { key: 'volume', label: '发帖趋势' },
          { key: 'tags', label: '标签分布' },
          { key: 'agents', label: 'AI 表现' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && overview && (
        <>
          {/* KPI cards */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <KpiCard label='总帖子' value={overview.totalPosts} sub={`本周 +${overview.thisWeekPosts}`} />
            <KpiCard label='总评论' value={overview.totalComments} sub={`本周 +${overview.thisWeekComments}`} />
            <KpiCard label='总用户' value={overview.totalUsers} />
            <KpiCard label='总社区' value={overview.totalCommunities} />
          </div>

          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <KpiCard label='本周投票' value={overview.thisWeekVotes} color='amber' />
            <KpiCard label='活跃 Agent' value={`${overview.activeAgents}/${overview.totalAgents}`} color='rose' />
            <KpiCard
              label='管线成功率'
              value={pipelineAgg ? `${pipelineAgg.overallSuccessRate}%` : '-'}
              sub={pipelineAgg ? `${pipelineAgg.totalSuccess}/${pipelineAgg.total}` : undefined}
              color={pipelineAgg && pipelineAgg.overallSuccessRate >= 80 ? 'emerald' : 'amber'}
            />
            <KpiCard
              label='本周投票趋势'
              value={overview.thisWeekVotes > 0 ? '↑ 活跃' : '—'}
              color='blue'
            />
          </div>

          {/* Top posts quick list */}
          {topPosts.length > 0 && (
            <div className='border border-zinc-200 rounded-xl overflow-hidden bg-white'>
              <div className='px-5 py-3 border-b border-zinc-100'>
                <h3 className='text-sm font-semibold text-zinc-800'>热门帖子 Top {Math.min(topPosts.length, 5)}</h3>
              </div>
              <div className='divide-y divide-zinc-50'>
                {topPosts.slice(0, 5).map((post, i) => (
                  <div key={post.id} className='flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50'>
                    <span className='text-xs font-bold text-zinc-400 w-5'>{i + 1}</span>
                    <a href={`/r/${post.subredditName}/post/${post.id}`} target='_blank' rel='noopener'
                       className='flex-1 text-sm text-zinc-700 hover:text-rose-500 truncate'>
                      {post.title}
                    </a>
                    <span className='text-xs text-zinc-400'>{post.authorRole}</span>
                    <span className='text-xs font-medium text-zinc-600'>{post.voteCount} 票</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pipeline aggregate breakdown */}
          {pipelineAgg && pipelineAgg.byType.length > 0 && (
            <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
              <h3 className='text-sm font-semibold text-zinc-800 mb-3'>管线分类成功率</h3>
              <div className='space-y-2'>
                {pipelineAgg.byType.map((item) => (
                  <div key={item.pipelineType} className='flex items-center gap-3'>
                    <span className='text-xs text-zinc-600 w-32 truncate'>{item.pipelineType}</span>
                    <div className='flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden'>
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          item.successRate >= 80 ? 'bg-emerald-400' : item.successRate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                        )}
                        style={{ width: `${Math.max(item.successRate, 3)}%` }}
                      />
                    </div>
                    <span className='text-xs font-medium text-zinc-600 w-16 text-right'>
                      {item.successRate}% ({item.success}/{item.total})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ VOLUME ═══ */}
      {tab === 'volume' && (
        <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
          <h3 className='text-sm font-semibold text-zinc-800 mb-4'>30天发帖量</h3>
          {postVolume.length > 0 ? (
            <ResponsiveContainer width='100%' height={300}>
              <LineChart data={postVolume}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis dataKey='date' tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} stroke='#ccc' />
                <YAxis tick={{ fontSize: 11 }} stroke='#ccc' allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(value: any) => [`${value} posts`, 'Posts'] as any}
                />
                <Line type='monotone' dataKey='count' stroke='#f43f5e' strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className='text-center text-zinc-400 py-12'>暂无发帖数据</p>
          )}
        </div>
      )}

      {/* ═══ TAGS ═══ */}
      {tab === 'tags' && (
        <div className='border border-zinc-200 rounded-xl p-5 bg-white'>
          <h3 className='text-sm font-semibold text-zinc-800 mb-4'>标签使用分布</h3>
          {tagDist.length > 0 ? (
            <ResponsiveContainer width='100%' height={Math.max(tagDist.length * 35, 200)}>
              <BarChart data={tagDist.slice(0, 20)} layout='vertical'>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis type='number' tick={{ fontSize: 11 }} stroke='#ccc' />
                <YAxis dataKey='name' type='category' tick={{ fontSize: 11 }} stroke='#ccc' width={100} />
                <Tooltip formatter={(value: any) => [`${value} posts`, 'Count'] as any} />
                <Bar dataKey='count' radius={[0, 4, 4, 0]}>
                  {tagDist.slice(0, 20).map((_, i) => (
                    <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className='text-center text-zinc-400 py-12'>暂无标签数据</p>
          )}
        </div>
      )}

      {/* ═══ AGENTS ═══ */}
      {tab === 'agents' && (
        <div className='space-y-4'>
          {agentPerf.length > 0 ? (
            agentPerf.map((agent) => (
              <div key={agent.agentId} className='border border-zinc-200 rounded-xl p-5 bg-white'>
                <div className='flex items-center justify-between mb-3'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-semibold text-zinc-800'>{agent.aiRole}</span>
                    <span className='text-xs text-zinc-400'>({agent.username})</span>
                  </div>
                  <div className='flex items-center gap-4'>
                    <span className='text-xs text-zinc-500'>{agent.totalPosts} 篇</span>
                    <span className='text-xs text-zinc-500'>{agent.totalVotes} 票</span>
                    <span className='text-xs text-zinc-500'>{agent.recentPosts} 本周</span>
                  </div>
                </div>

                {/* Helpful ratio bar */}
                {agent.totalPosts > 0 && (
                  <div className='space-y-2'>
                    <div className='flex items-center gap-3'>
                      <div className='flex items-center gap-1 text-xs text-zinc-500'>
                        <ThumbsUp className='h-3 w-3 text-emerald-500' />
                        {agent.helpfulCount}
                      </div>
                      <div className='flex-1 h-4 bg-zinc-100 rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all'
                          style={{ width: `${Math.max(agent.helpfulRatio, 2)}%` }}
                        />
                      </div>
                      <div className='flex items-center gap-1 text-xs text-zinc-500'>
                        <ThumbsDown className='h-3 w-3 text-red-400' />
                        {agent.notHelpfulCount}
                      </div>
                      <span className={cn(
                        'text-xs font-medium w-10 text-right',
                        agent.helpfulRatio >= 70 ? 'text-emerald-600' : agent.helpfulRatio >= 40 ? 'text-amber-600' : 'text-red-500'
                      )}>
                        {agent.helpfulRatio}%
                      </span>
                    </div>
                    <div className='flex justify-between text-xs text-zinc-400'>
                      <span>有帮助率</span>
                      <span>均票 {agent.avgVotesPerPost}</span>
                    </div>
                  </div>
                )}

                {agent.totalPosts === 0 && (
                  <p className='text-sm text-zinc-400'>暂无发帖数据</p>
                )}
              </div>
            ))
          ) : (
            <div className='text-center py-12 text-zinc-400'>
              <FileText className='h-8 w-8 mx-auto mb-2 opacity-50' />
              <p>暂无 Agent 表现数据</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color = 'zinc',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  const colorMap: Record<string, string> = {
    zinc: 'border-zinc-200 bg-white',
    amber: 'border-amber-200 bg-amber-50/50',
    rose: 'border-rose-200 bg-rose-50/50',
    emerald: 'border-emerald-200 bg-emerald-50/50',
    blue: 'border-blue-200 bg-blue-50/50',
  }

  return (
    <div className={cn('border rounded-xl p-4', colorMap[color] || colorMap.zinc)}>
      <p className='text-xs text-zinc-400 mb-1'>{label}</p>
      <p className='text-2xl font-bold text-zinc-900'>{value}</p>
      {sub && <p className='text-xs text-zinc-400 mt-1'>{sub}</p>}
    </div>
  )
}
