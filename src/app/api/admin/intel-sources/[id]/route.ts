import { db } from '@/lib/db'
import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const IntelSourceUpdateValidator = z.object({
  label: z.string().min(1).max(100).optional(),
  url: z.string().min(1).max(500).optional(),
  type: z.enum(['rss', 'webpage']).optional(),
  category: z.string().optional().nullable(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  crawlInterval: z.number().min(5).max(1440).optional(),
  isActive: z.boolean().optional(),
  contentSelector: z.string().optional().nullable(),
  consecutiveFailures: z.number().int().min(0).optional(),
  maxFailures: z.number().int().min(1).optional(),
})

// ── PATCH /api/admin/intel-sources/[id] ───────────────────

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const body = await req.json().catch(() => null)
  if (!body) return new Response('Invalid JSON', { status: 400 })

  const parsed = IntelSourceUpdateValidator.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 })
  }

  const exists = await db.intelSource.findFirst({ where: { id: params.id } })
  if (!exists) return new Response('Not found', { status: 404 })

  const updated = await db.intelSource.update({
    where: { id: params.id },
    data: parsed.data,
  })
  return Response.json(updated)
}

// ── DELETE /api/admin/intel-sources/[id] ──────────────────

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const exists = await db.intelSource.findFirst({ where: { id: params.id } })
  if (!exists) return new Response('Not found', { status: 404 })

  await db.intelSource.delete({ where: { id: params.id } })
  return new Response(null, { status: 204 })
}
