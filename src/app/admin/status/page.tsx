import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redis } from '@/lib/redis'
import { redirect } from 'next/navigation'
import { AdminStatusCards } from '@/components/admin/AdminStatusCards'
import { getDictionary } from '@/i18n'

const startTime = Date.now()

export default async function AdminStatusPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  // DB check
  let dbStatus: 'ok' | 'error' = 'error'
  let dbLatency = 0
  let dbError: string | null = null
  try {
    const t0 = Date.now()
    await db.user.count({ where: {} })
    dbLatency = Date.now() - t0
    dbStatus = 'ok'
  } catch (e: any) {
    dbError = e.message || String(e)
  }

  // Redis check
  let redisStatus: 'ok' | 'error' = 'error'
  let redisLatency = 0
  try {
    const t0 = Date.now()
    await redis.ping()
    redisLatency = Date.now() - t0
    redisStatus = 'ok'
  } catch {
    // Redis unavailable
  }

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.systemStatus}</h1>
      {dbError && (
        <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>
          DB 检查失败: {dbError}
        </div>
      )}
      <AdminStatusCards
        status={{
          database: { status: dbStatus, latencyMs: dbLatency },
          redis: { status: redisStatus, latencyMs: redisLatency },
          uptimeMs: Date.now() - startTime,
        }}
        labels={{
          database: dict.admin.database,
          redis: dict.admin.redis,
          uptime: dict.admin.uptime,
          healthy: dict.admin.healthy,
          unhealthy: dict.admin.unhealthy,
        }}
      />
    </div>
  )
}
