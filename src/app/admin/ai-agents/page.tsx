import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminAgentsList } from '@/components/admin/AdminAgentsList'
import { getDictionary } from '@/i18n'

export default async function AdminAIAgentsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  let agentsWithStats: any[] = [], dbError: string | null = null

  try {
    const agents = (await db.user.findMany({
      where: { isAI: true },
      select: { id: true, username: true, aiRole: true, image: true },
    })) as any[]

    agentsWithStats = await Promise.all(
      (agents || []).map(async (agent: any) => {
        try {
          const postCount = await db.post.count({ where: { authorId: agent.id } })
          return { ...agent, postCount }
        } catch {
          return { ...agent, postCount: 0 }
        }
      })
    )
  } catch (e: any) {
    dbError = e.message || String(e)
  }

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.aiAgents}</h1>
      {dbError && (
        <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>
          数据加载失败: {dbError}
        </div>
      )}
      <AdminAgentsList agents={agentsWithStats} />
    </div>
  )
}
