import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { ForgotPasswordValidator } from '@/lib/validators/auth'
import { checkRateLimit, getClientIP } from '@/lib/rate-limiter'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const ip = getClientIP(req)
    const limit = checkRateLimit(ip)
    if (!limit.allowed) {
      return new Response(
        JSON.stringify({ message: limit.reason }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { email } = ForgotPasswordValidator.parse(body)

    const user = await db.user.findFirst({
      where: { email },
      select: { id: true, email: true },
    })

    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      await db.user.update({
        where: { id: (user as any).id },
        data: {
          resetToken: token,
          resetTokenExpiry: new Date(Date.now() + 3600000),
        },
      })
      await sendPasswordResetEmail(email, token)
    }

    return new Response(
      JSON.stringify({ message: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[forgot-password] Error:', error)
    return new Response(
      JSON.stringify({ message: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
