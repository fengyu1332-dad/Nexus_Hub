import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminAgentsList } from '@/components/admin/AdminAgentsList'
import { getDictionary } from '@/i18n'

export default async function AdminAIAgentsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  const agents = (await db.user.findMany({
    where: { isAI: true },
    select: { id: true, username: true, aiRole: true, image: true },
  })) as any[]

  const agentsWithStats = await Promise.all(
    (agents || []).map(async (agent: any) => {
      try {
        const postCount = await db.post.count({ where: { authorId: agent.id } })
        return { ...agent, postCount }
      } catch {
        return { ...agent, postCount: 0 }
      }
    })
  )

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.aiAgents}</h1>
      <AdminAgentsList agents={agentsWithStats} />
    </div>
  )
}
