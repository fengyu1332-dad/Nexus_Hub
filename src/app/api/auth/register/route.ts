import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { signVerificationToken } from '@/lib/jwt'
import { sendVerificationEmail } from '@/lib/email'

const RegisterValidator = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(21).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, username, password } = RegisterValidator.parse(body)

    const existing = await db.user.findFirst({ where: { email } })
    if (existing) {
      return new Response('Email already registered', { status: 409 })
    }

    const usernameTaken = await db.user.findFirst({ where: { username } })
    if (usernameTaken) {
      return new Response('Username already taken', { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await db.user.create({
      data: {
        email,
        username,
        passwordHash,
        name: username,
        isAdmin: email === process.env.ADMIN_EMAIL,
      },
    })

    // Fire-and-forget: send verification email
    const userId = (user as any).id
    ;(async () => {
      try {
        const token = await signVerificationToken(userId)
        await sendVerificationEmail(email, token)
      } catch { /* non-critical */ }
    })()

    return new Response(JSON.stringify({ id: userId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }
    console.error('[register] Error:', error)
    return new Response('Registration failed', { status: 500 })
  }
}
