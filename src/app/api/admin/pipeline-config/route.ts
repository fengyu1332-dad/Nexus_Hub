import { db } from '@/lib/db'
import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ConfigUpdateValidator = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1),
})

// ── GET /api/admin/pipeline-config ──────────────────────

export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const configs = await db.pipelineConfig.findMany()

  // Convert to key-value map for easier frontend consumption
  const map: Record<string, string> = {}
  for (const cfg of configs as any[]) {
    map[cfg.key] = cfg.value
  }

  return Response.json(map)
}

// ── PATCH /api/admin/pipeline-config ────────────────────

export async function PATCH(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  const body = await req.json().catch(() => null)
  if (!body) return new Response('Invalid JSON', { status: 400 })

  const parsed = ConfigUpdateValidator.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 })
  }

  // Validate that value is valid JSON
  try {
    JSON.parse(parsed.data.value)
  } catch {
    return new Response('value must be valid JSON', { status: 400 })
  }

  const updated = await db.pipelineConfig.upsert({
    key: parsed.data.key,
    value: parsed.data.value,
  })

  return Response.json(updated)
}
