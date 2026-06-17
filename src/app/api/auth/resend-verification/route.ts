import { getAuthSession } from '@/lib/auth'
import { signVerificationToken } from '@/lib/jwt'
import { sendVerificationEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = (session.user as any).id
    const email = (session.user as any).email
    if (!userId || !email) {
      return new Response('No email', { status: 400 })
    }

    const token = await signVerificationToken(userId)
    await sendVerificationEmail(email, token)

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[resend-verification] Error:', error)
    return new Response('Could not resend verification', { status: 500 })
  }
}
