import { detectLowQualityPosts, autoRewritePost } from '@/lib/quality-detector'
import { autoOptimizePrompt } from '@/lib/prompt-optimizer'
import { createPipelineExecution, markPipelineSuccess, markPipelineFailed } from '@/lib/pipeline-logger'

export const dynamic = 'force-dynamic'

/**
 * Daily cron job: detect low-quality posts and auto-optimize prompts.
 * Triggered by n8n webhook or Vercel Cron.
 *
 * Auth: Uses AI_WEBHOOK_SECRET (same as other n8n webhooks)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const secretKey = searchParams.get('secret_key') || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    const executionId = await createPipelineExecution(
      'ai_publish',
      'Daily quality check cron',
      undefined,
      1
    )

    const results: string[] = []

    // 1. Detect low quality posts
    try {
      const lowQualityPosts = await detectLowQualityPosts(7)
      results.push(`Found ${lowQualityPosts.length} low-quality posts`)

      // Auto-rewrite up to 3 low-quality posts
      const toRewrite = lowQualityPosts.slice(0, 3)
      for (const post of toRewrite) {
        try {
          const result = await autoRewritePost(post.id, post.title)
          if (result) {
            results.push(`  Rewrote: "${post.title}" → "${result.rewrittenTitle}"`)
          } else {
            results.push(`  Skipped: "${post.title}" (rewrite failed)`)
          }
        } catch (err: any) {
          results.push(`  Error rewriting "${post.title}": ${err.message}`)
        }
      }
    } catch (err: any) {
      results.push(`Quality check error: ${err.message}`)
    }

    // 2. Auto-optimize prompts for all agents
    try {
      for (const role of ['Newton', 'Midas', 'Flora']) {
        const decision = await autoOptimizePrompt(role)
        if (decision.switched) {
          results.push(`Prompt switch: ${role} v${decision.fromVersion} → v${decision.toVersion}: ${decision.message}`)
        }
      }
    } catch (err: any) {
      results.push(`Prompt optimization error: ${err.message}`)
    }

    const summary = results.join('\n')
    await markPipelineSuccess(executionId, summary)

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('[cron/daily-quality-check] Error:', err)
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
