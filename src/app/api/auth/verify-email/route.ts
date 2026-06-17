import { db } from '@/lib/db'
import { verifyToken } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Token expired or invalid' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await db.user.update({
      where: { id: payload.userId },
      data: { emailVerified: new Date().toISOString() },
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[verify-email] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Verification failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
