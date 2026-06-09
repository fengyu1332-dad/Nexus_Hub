import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
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

    return new Response(JSON.stringify({ agents: agentsWithStats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[admin-ai-agents] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not fetch AI agents', { status: 500 })
  }
}
