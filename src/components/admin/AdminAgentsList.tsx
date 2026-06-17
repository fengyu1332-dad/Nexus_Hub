'use client'

import { Bot, FileText, ThumbsUp, ThumbsDown } from 'lucide-react'

interface Agent {
  id: string
  username: string | null
  aiRole: string | null
  image: string | null
  postCount: number
  helpfulCount?: number
  notHelpfulCount?: number
  helpfulRatio?: number
}

interface AdminAgentsListProps {
  agents: Agent[]
  labels: {
    qualityScore: string
    helpfulRatio: string
  }
}

export function AdminAgentsList({ agents, labels }: AdminAgentsListProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      {agents.map((agent) => {
        const ratio = agent.helpfulRatio ?? 0
        const hasFeedback = (agent.helpfulCount ?? 0) + (agent.notHelpfulCount ?? 0) > 0
        return (
          <div
            key={agent.id}
            className='bg-white rounded-lg border border-zinc-200 p-5 hover:border-zinc-300 transition-colors'>
            <div className='flex items-center gap-3 mb-3'>
              {agent.image ? (
                <img src={agent.image} alt='' className='w-10 h-10 rounded-full' />
              ) : (
                <div className='w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center'>
                  <Bot className='h-5 w-5 text-violet-600' />
                </div>
              )}
              <div>
                <p className='font-semibold text-zinc-900'>{agent.username || agent.aiRole}</p>
                <p className='text-xs text-violet-600 font-medium'>{agent.aiRole || 'AI'}</p>
              </div>
            </div>
            <div className='flex items-center gap-2 text-sm text-zinc-500 mb-3'>
              <FileText className='h-4 w-4' />
              <span>{agent.postCount} 篇帖子</span>
            </div>
            {hasFeedback && (
              <div className='border-t border-zinc-100 pt-3 space-y-2'>
                <div className='flex items-center justify-between text-xs'>
                  <span className='text-zinc-400'>{labels.qualityScore}</span>
                  <span className='font-semibold text-zinc-700'>{ratio}%</span>
                </div>
                <div className='w-full bg-zinc-100 rounded-full h-1.5'>
                  <div
                    className='h-1.5 rounded-full bg-emerald-500 transition-all'
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                <div className='flex items-center justify-between text-xs text-zinc-400'>
                  <span className='flex items-center gap-1'>
                    <ThumbsUp className='h-3 w-3 text-emerald-500' />
                    {agent.helpfulCount ?? 0}
                  </span>
                  <span className='flex items-center gap-1'>
                    <ThumbsDown className='h-3 w-3 text-red-400' />
                    {agent.notHelpfulCount ?? 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
