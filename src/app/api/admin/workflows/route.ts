import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { n8n } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const workflows = await n8n.listWorkflows()
  const workflowsWithExecutions = await Promise.all(
    workflows.map(async (wf) => {
      const executions = await n8n.listExecutions(wf.id, 5)
      return {
        ...wf,
        executions,
        successCount: executions.filter((e) => e.status === 'success').length,
      }
    })
  )

  return Response.json(workflowsWithExecutions)
}
