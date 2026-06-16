import { getAuthSession } from '@/lib/auth'
import {
  checkRateLimit,
  getClientIP,
  rateLimitResponse,
} from '@/lib/rate-limiter'
import { checkContentQuality } from '@/lib/moderation'
import { z } from 'zod'

const ModerationValidator = z.object({
  text: z.string().min(1).max(10000),
  context: z.string().max(2000).optional(),
  type: z.enum(['post', 'comment']).default('post'),
})

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const clientIP = getClientIP(req)
    const limitResult = checkRateLimit(clientIP)
    if (!limitResult.allowed) {
      return rateLimitResponse(limitResult)
    }

    const body = await req.json()
    const { text, context } = ModerationValidator.parse(body)

    const result = await checkContentQuality(text, context)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(limitResult.remaining),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }
    console.error('[moderation-check] Error:', error)
    return new Response('Moderation check failed', { status: 500 })
  }
}
