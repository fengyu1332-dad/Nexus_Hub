import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UserPatchValidator = z.object({
  isAdmin: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = await req.json()
    const { isAdmin } = UserPatchValidator.parse(body)

    await db.user.update({
      where: { id: params.id },
      data: { isAdmin },
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }
    console.error('[admin-users-patch] Error:', error instanceof Error ? error.message : String(error))
    return new Response('Could not update user', { status: 500 })
  }
}
