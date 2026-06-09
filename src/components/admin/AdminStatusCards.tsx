'use client'

import { useDict } from '@/components/I18nProvider'
import { Database, Server, Clock, Circle } from 'lucide-react'

interface StatusCheck {
  status: 'ok' | 'error'
  latencyMs: number
}

interface StatusData {
  database: StatusCheck
  redis: StatusCheck
  uptimeMs: number
}

export function AdminStatusCards({ status }: { status: StatusData }) {
  const dict = useDict()

  const dbHealthy = status.database.status === 'ok'
  const redisHealthy = status.redis.status === 'ok'

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        {/* Database */}
        <div className='bg-white rounded-lg border border-zinc-200 p-5'>
          <div className='flex items-center gap-3 mb-2'>
            <Database className='h-5 w-5 text-zinc-500' />
            <p className='font-medium text-zinc-900'>{dict.admin.database}</p>
            <Circle
              className={`h-2.5 w-2.5 ${dbHealthy ? 'text-emerald-500 fill-emerald-500' : 'text-red-500 fill-red-500'}`}
            />
            <span className={`text-xs font-medium ${dbHealthy ? 'text-emerald-600' : 'text-red-600'}`}>
              {dbHealthy ? dict.admin.healthy : dict.admin.unhealthy}
            </span>
          </div>
          <p className='text-sm text-zinc-500'>延迟: {status.database.latencyMs}ms</p>
        </div>

        {/* Redis */}
        <div className='bg-white rounded-lg border border-zinc-200 p-5'>
          <div className='flex items-center gap-3 mb-2'>
            <Server className='h-5 w-5 text-zinc-500' />
            <p className='font-medium text-zinc-900'>{dict.admin.redis}</p>
            <Circle
              className={`h-2.5 w-2.5 ${redisHealthy ? 'text-emerald-500 fill-emerald-500' : 'text-red-500 fill-red-500'}`}
            />
            <span className={`text-xs font-medium ${redisHealthy ? 'text-emerald-600' : 'text-red-600'}`}>
              {redisHealthy ? dict.admin.healthy : dict.admin.unhealthy}
            </span>
          </div>
          <p className='text-sm text-zinc-500'>延迟: {status.redis.latencyMs}ms</p>
        </div>
      </div>

      {/* Uptime */}
      <div className='bg-white rounded-lg border border-zinc-200 p-5'>
        <div className='flex items-center gap-3'>
          <Clock className='h-5 w-5 text-zinc-500' />
          <p className='font-medium text-zinc-900'>{dict.admin.uptime}</p>
        </div>
        <p className='text-2xl font-bold text-zinc-900 mt-2'>
          {Math.floor(status.uptimeMs / 1000 / 60)}m {Math.floor((status.uptimeMs / 1000) % 60)}s
        </p>
      </div>
    </div>
  )
}
