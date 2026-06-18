import { db } from '@/lib/db'
import { createPipelineExecution, markPipelineSuccess, markPipelineFailed } from '@/lib/pipeline-logger'
import { buildNewtonPrompt } from '@/lib/persona/newton'
import { buildMidasPrompt } from '@/lib/persona/midas'

interface PipelineStep {
  agent: 'Newton' | 'Midas' | 'Flora'
  status: 'pending' | 'running' | 'success' | 'failed'
  output?: string
  error?: string
  postId?: string
  postTitle?: string
}

interface PipelineResult {
  executionId: string
  steps: PipelineStep[]
  finalPostId?: string
  success: boolean
}

/**
 * Run the full AI content pipeline:
 *   Newton (draft) → Midas (SEO optimize) → Flora (community comment)
 *
 * Each step is independent: failure doesn't block downstream steps.
 * Results are recorded to PipelineExecution for observability.
 */
export async function runContentPipeline(
  topic: string,
  sourceArticle?: string
): Promise<PipelineResult> {
  const executionId = await createPipelineExecution(
    'ai_publish',
    `Content pipeline: ${topic.substring(0, 80)}`,
    undefined,
    1
  )

  const steps: PipelineStep[] = [
    { agent: 'Newton', status: 'pending' },
    { agent: 'Midas', status: 'pending' },
    { agent: 'Flora', status: 'pending' },
  ]

  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) {
    await markPipelineFailed(executionId, 'DEEPSEEK_API_KEY not configured')
    return { executionId, steps, success: false }
  }

  // ── Step 1: Newton drafts the article ──────────────
  steps[0].status = 'running'
  try {
    const newtonPrompt = await buildNewtonPrompt()
    const draftContent = await callDeepSeek(
      deepseekKey,
      `${newtonPrompt}\n\nWrite a comprehensive academic article about: ${topic}${sourceArticle ? `\n\nSource material: ${sourceArticle}` : ''}\n\nRespond with JSON: { "title": "...", "content": {"blocks":[{"type":"paragraph","data":{"text":"..."}}]} }`
    )

    // Try to parse the JSON response
    let title = topic
    let content: any = null
    try {
      const match = draftContent.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        title = parsed.title || topic
        content = parsed.content
      }
    } catch {
      // Use raw response
      content = {
        blocks: [
          { type: 'paragraph', data: { text: draftContent.substring(0, 5000) } },
        ],
      }
    }

    steps[0].output = title
    steps[0].status = 'success'
    steps[0].postTitle = title

    // ── Step 2: Midas SEO optimizes ──────────────
    steps[1].status = 'running'
    try {
      const midasPrompt = await buildMidasPrompt()
      const seoResponse = await callDeepSeek(
        deepseekKey,
        `${midasPrompt}\n\nOriginal title: "${title}"\nContent summary: ${draftContent.substring(0, 1000)}\n\nSuggest an SEO-optimized title and 3 distribution channels. Respond with JSON: { "optimizedTitle": "...", "channels": ["..."] }`
      )

      let optimizedTitle = title
      let channels: string[] = []
      try {
        const match = seoResponse.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          optimizedTitle = parsed.optimizedTitle || title
          channels = parsed.channels || []
        }
      } catch { /* use original */ }

      // Apply SEO title
      if (optimizedTitle !== title) {
        title = optimizedTitle
        content = {
          ...(content || {}),
          seoOptimized: true,
          distributionChannels: channels,
        }
      }

      steps[1].output = `SEO optimized → "${title}" | Channels: ${channels.join(', ') || 'default'}`
      steps[1].status = 'success'
    } catch (err: any) {
      steps[1].status = 'failed'
      steps[1].error = err.message
    }

    // ── Publish the post ──────────────────────────
    let postId: string | undefined
    let publishAuthorId: string | undefined
    try {
      // Find or create a "Nexus" subreddit
      let subreddit = await db.subreddit.findFirst({
        where: { name: 'Nexus' },
        select: { id: true },
      }).catch(() => null)

      if (!subreddit) {
        subreddit = (await db.subreddit.create({
          data: { name: 'Nexus', displayName: 'Nexus Hub', about: 'AI-generated academic content' },
        }).catch(() => null)) as any
      }

      // Find Newton's user account (create if needed)
      const newtonUsers = await db.user.findMany({
        where: { isAI: true, aiRole: 'Newton' },
        select: { id: true },
      }).catch(() => []) as { id: string }[]

      publishAuthorId = newtonUsers[0]?.id
      if (!publishAuthorId) {
        // Fallback to any AI user
        const anyAiUser = await db.user.findFirst({
          where: { isAI: true },
          select: { id: true },
        }).catch(() => null)
        publishAuthorId = (anyAiUser as any)?.id
      }

      if (publishAuthorId && subreddit) {
        const post = await db.post.create({
          data: {
            title,
            content: JSON.stringify(content),
            authorId: publishAuthorId,
            subredditId: (subreddit as any).id,
            status: 'PUBLISHED',
          },
        }).catch(() => null)

        if (post) {
          postId = (post as any).id
          steps[0].postId = postId
        }
      }
    } catch (err: any) {
      steps[0].error = `Publish failed: ${err.message}`
    }

    // ── Step 3: Flora comments ────────────────────
    if (postId) {
      steps[2].status = 'running'
      try {
        const floraComment = await callDeepSeek(
          deepseekKey,
          `You are Flora, a friendly senior student. Read this article titled "${title}" and write a supportive, engaging comment (1-3 sentences) that adds value or asks a thought-provoking question. Keep it warm and natural.`
        )

        // Create Flora's user or find existing
        const floraUsers = await db.user.findMany({
          where: { isAI: true, aiRole: 'Flora' },
          select: { id: true },
        }).catch(() => []) as { id: string }[]

        const floraId = floraUsers[0]?.id || publishAuthorId
        if (floraId) {
          await db.comment.create({
            data: {
              text: floraComment.substring(0, 1000),
              postId,
              authorId: floraId,
            },
          }).catch(() => {})
        }

        steps[2].output = floraComment.substring(0, 200)
        steps[2].status = 'success'
        steps[2].postId = postId
      } catch (err: any) {
        steps[2].status = 'failed'
        steps[2].error = err.message
      }
    } else {
      steps[2].status = 'failed'
      steps[2].error = 'No post to comment on (publish failed)'
      // Skip Flora step
    }

    const allSuccess = steps.every((s) => s.status === 'success')
    if (allSuccess) {
      await markPipelineSuccess(executionId, `Pipeline complete: "${title}" | Post ${postId}`)
    } else {
      const failedSteps = steps.filter((s) => s.status === 'failed').map((s) => s.agent).join(', ')
      await markPipelineFailed(executionId, `Steps failed: ${failedSteps}`)
    }

    return { executionId, steps, finalPostId: postId, success: allSuccess }
  } catch (err: any) {
    await markPipelineFailed(executionId, err.message)
    steps[0].status = 'failed'
    steps[0].error = err.message
    return { executionId, steps, success: false }
  }
}

/**
 * Low-level DeepSeek API call.
 */
async function callDeepSeek(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error')
    throw new Error(`DeepSeek API error ${res.status}: ${errText}`)
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}
