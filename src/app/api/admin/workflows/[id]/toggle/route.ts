import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { n8n } from '@/lib/n8n'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ToggleValidator = z.object({
  active: z.boolean(),
})

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const body = await req.json().catch(() => null)
  if (!body) return new Response('Invalid JSON', { status: 400 })

  const parsed = ToggleValidator.safeParse(body)
  if (!parsed.success) return new Response('Invalid body', { status: 400 })

  const ok = parsed.data.active
    ? await n8n.activateWorkflow(params.id)
    : await n8n.deactivateWorkflow(params.id)

  if (!ok) {
    return new Response('Failed to toggle workflow', { status: 500 })
  }

  return new Response(null, { status: 204 })
}
