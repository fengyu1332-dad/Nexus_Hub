import { db } from '@/lib/db'
import { ResetPasswordValidator } from '@/lib/validators/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, password } = ResetPasswordValidator.parse(body)

    const user = (await db.user.findFirst({
      where: { resetToken: token },
      select: { id: true, resetTokenExpiry: true },
    })) as { id: string; resetTokenExpiry: string | null } | null

    if (!user || !user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      return new Response(
        JSON.stringify({ message: 'This link is expired or invalid.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    return new Response(
      JSON.stringify({ message: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[reset-password] Error:', error)
    return new Response(
      JSON.stringify({ message: 'Could not reset password' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
