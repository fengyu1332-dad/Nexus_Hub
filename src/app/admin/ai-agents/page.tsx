import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminAgentsList } from '@/components/admin/AdminAgentsList'
import { PromptVersionEditor } from '@/components/admin/PromptVersionEditor'
import { AgentPipelineRunner } from '@/components/admin/AgentPipelineRunner'
import { QualityRewriter } from '@/components/admin/QualityRewriter'
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

    // Fetch quality metrics for each agent via PostFeedback
    try {
      const agentIds = agents?.map((a: any) => a.id) || []
      if (agentIds.length > 0) {
        const allFeedback = await db.postFeedback.findMany({
          select: { id: true, postId: true, rating: true },
        }) as any[]
        const allAiPosts = await db.post.findMany({
          where: { authorId: { in: agentIds }, status: 'PUBLISHED' },
          select: { id: true, authorId: true, title: true },
          take: 500,
        }) as any[]
        const postAuthorMap = new Map<string, string>()
        for (const p of allAiPosts) postAuthorMap.set(p.id, p.authorId)

        const feedbackByPost = new Map<string, { helpful: number; notHelpful: number }>()
        for (const f of allFeedback) {
          const entry = feedbackByPost.get(f.postId) || { helpful: 0, notHelpful: 0 }
          if (f.rating === 'helpful') entry.helpful++
          else entry.notHelpful++
          feedbackByPost.set(f.postId, entry)
        }

        const agentFeedback = new Map<string, { helpful: number; notHelpful: number }>()
        for (const p of allAiPosts) {
          const agentId = postAuthorMap.get(p.id)
          if (!agentId) continue
          const fb = feedbackByPost.get(p.id)
          if (fb) {
            const cur = agentFeedback.get(agentId) || { helpful: 0, notHelpful: 0 }
            cur.helpful += fb.helpful
            cur.notHelpful += fb.notHelpful
            agentFeedback.set(agentId, cur)
          }
        }

        agentsWithStats = agentsWithStats.map((a: any) => {
          const fb = agentFeedback.get(a.id) || { helpful: 0, notHelpful: 0 }
          const total = fb.helpful + fb.notHelpful
          return {
            ...a,
            helpfulCount: fb.helpful,
            notHelpfulCount: fb.notHelpful,
            helpfulRatio: total > 0 ? Math.round((fb.helpful / total) * 100) : 0,
          }
        })
      }
    } catch {
      // feedback table may not exist yet
    }
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
      <AdminAgentsList agents={agentsWithStats} labels={{
        qualityScore: dict.aiFeedback.qualityScore,
        helpfulRatio: dict.aiFeedback.helpfulRatio,
      }} />

      <hr className='border-zinc-200' />

      {/* Agent Pipeline Runner */}
      <AgentPipelineRunner />

      <hr className='border-zinc-200' />

      {/* Quality Rewriter */}
      <QualityRewriter />

      <hr className='border-zinc-200' />

      <PromptVersionEditor labels={{
        title: dict.promptVersion.title,
        agentRole: dict.promptVersion.agentRole,
        promptName: dict.promptVersion.promptName,
        version: dict.promptVersion.version,
        active: dict.promptVersion.active,
        setActive: dict.promptVersion.setActive,
        newVersion: dict.promptVersion.newVersion,
        changeNotes: dict.promptVersion.changeNotes,
        history: dict.promptVersion.history,
      }} />
    </div>
  )
}
