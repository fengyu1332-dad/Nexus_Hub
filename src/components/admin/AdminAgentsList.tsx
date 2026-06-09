'use client'

import { Bot, FileText } from 'lucide-react'

interface Agent {
  id: string
  username: string | null
  aiRole: string | null
  image: string | null
  postCount: number
}

export function AdminAgentsList({ agents }: { agents: Agent[] }) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
      {agents.map((agent) => (
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
          <div className='flex items-center gap-2 text-sm text-zinc-500'>
            <FileText className='h-4 w-4' />
            <span>{agent.postCount} 篇帖子</span>
          </div>
        </div>
      ))}
    </div>
  )
}
