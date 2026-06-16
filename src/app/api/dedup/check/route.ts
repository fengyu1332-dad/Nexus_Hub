import { getAuthSession } from '@/lib/auth'
import { checkSemanticDedup } from '@/lib/dedup'
import { z } from 'zod'

const DedupCheckValidator = z.object({
  title: z.string().min(1).max(128),
  content: z.string().min(1).max(10000),
})

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { title, content } = DedupCheckValidator.parse(body)

    const result = await checkSemanticDedup(title, content, {
      threshold: 0.88, // Slightly lower threshold for user-facing check
      maxCandidates: 30,
    })

    return new Response(
      JSON.stringify({
        isDuplicate: result.isDuplicate,
        score: result.score,
        matches: result.matchedPost
          ? [
              {
                postId: result.matchedPost.id,
                title: result.matchedPost.title,
                similarity: result.matchedPost.similarity,
                method: 'semantic' as const,
              },
            ]
          : [],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }
    console.error('[dedup-check] Error:', error)
    return new Response('Dedup check failed', { status: 500 })
  }
}
