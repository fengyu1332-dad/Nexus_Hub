'use client'

import { useState } from 'react'
import { Play, Loader2, CheckCircle2, XCircle, Circle, ExternalLink, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import axios from 'axios'

interface StepResult {
  agent: 'Newton' | 'Midas' | 'Flora'
  status: 'pending' | 'running' | 'success' | 'failed'
  output?: string
  error?: string
  postId?: string
  postTitle?: string
}

interface PipelineResult {
  executionId: string
  steps: StepResult[]
  finalPostId?: string
  success: boolean
}

const AGENT_ICONS: Record<string, string> = {
  Newton: '📝',
  Midas: '📡',
  Flora: '🌸',
}

const AGENT_LABELS: Record<string, string> = {
  Newton: '首席主笔 (Newton)',
  Midas: 'SEO 总监 (Midas)',
  Flora: '树洞客服 (Flora)',
}

const STEP_DESCRIPTIONS: Record<string, string> = {
  Newton: '撰写学术文章初稿',
  Midas: 'SEO 优化标题与分发策略',
  Flora: '生成社区互动评论',
}

export function AgentPipelineRunner() {
  const [topic, setTopic] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    if (!topic.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const { data } = await axios.post('/api/admin/agent-pipeline/run', {
        topic: topic.trim(),
      })
      setResult(data)
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Pipeline 执行失败')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className='space-y-4'>
      {/* Input area */}
      <div className='bg-white border border-zinc-200 rounded-xl p-5'>
        <h3 className='text-sm font-semibold text-zinc-800 mb-3'>运行 AI 内容 Pipeline</h3>
        <p className='text-xs text-zinc-500 mb-3'>
          Newton 撰写 → Midas SEO 优化 → Flora 社区评论。输入一个主题即可自动完成全流程。
        </p>
        <div className='flex gap-3'>
          <input
            type='text'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder='输入写作主题，如：美国大学早申策略分析'
            className='flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
          />
          <button
            onClick={handleRun}
            disabled={running || !topic.trim()}
            className='inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500 text-white text-sm font-medium rounded-lg hover:bg-rose-600 disabled:opacity-50 transition-colors'>
            {running ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Play className='h-4 w-4' />
            )}
            {running ? '执行中...' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {/* Result display */}
      {(running || result) && (
        <div className='bg-white border border-zinc-200 rounded-xl overflow-hidden'>
          <div className='px-5 py-3 border-b border-zinc-100 bg-zinc-50'>
            <h3 className='text-sm font-semibold text-zinc-800'>
              {running ? 'Pipeline 执行中...' : result?.success ? 'Pipeline 完成' : 'Pipeline 完成（部分步骤失败）'}
            </h3>
          </div>

          <div className='divide-y divide-zinc-100'>
            {(result?.steps || [
              { agent: 'Newton', status: 'running' },
              { agent: 'Midas', status: 'pending' },
              { agent: 'Flora', status: 'pending' },
            ]).map((step) => (
              <div key={step.agent} className='px-5 py-3.5'>
                <div className='flex items-start gap-3'>
                  {/* Status icon */}
                  <div className='mt-0.5'>
                    {step.status === 'running' && (
                      <Loader2 className='h-5 w-5 animate-spin text-blue-500' />
                    )}
                    {step.status === 'success' && (
                      <CheckCircle2 className='h-5 w-5 text-emerald-500' />
                    )}
                    {step.status === 'failed' && (
                      <XCircle className='h-5 w-5 text-red-500' />
                    )}
                    {step.status === 'pending' && (
                      <Circle className='h-5 w-5 text-zinc-300' />
                    )}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-0.5'>
                      <span className='text-sm font-medium text-zinc-800'>
                        {AGENT_ICONS[step.agent]} {AGENT_LABELS[step.agent]}
                      </span>
                      <span className='text-xs text-zinc-400'>{STEP_DESCRIPTIONS[step.agent]}</span>
                    </div>

                    {step.output && (
                      <p className='text-xs text-zinc-600 mt-1 line-clamp-2'>{step.output}</p>
                    )}
                    {step.error && (
                      <p className='text-xs text-red-500 mt-1'>{step.error}</p>
                    )}

                    {step.postId && step.status === 'success' && (
                      <a
                        href={`/r/Nexus/post/${step.postId}`}
                        target='_blank'
                        rel='noopener'
                        className='inline-flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 mt-1 font-medium'>
                        <ExternalLink className='h-3 w-3' />
                        查看帖子
                        {step.postTitle && ` — ${step.postTitle}`}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className='p-4 bg-red-50 rounded-lg border border-red-200 text-sm text-red-600'>{error}</div>
      )}
    </div>
  )
}
