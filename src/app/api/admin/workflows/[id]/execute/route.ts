import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { n8n } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const result = await n8n.executeWorkflow(params.id)
  if (!result) {
    return new Response('Failed to execute workflow', { status: 500 })
  }

  return Response.json(result)
}
