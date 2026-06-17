import { db } from '@/lib/db'
import { getEmbedding } from '@/lib/embedding'
import { createPipelineExecution, markPipelineSuccess, markPipelineFailed } from '@/lib/pipeline-logger'

let _counter = 0
function generateId(): string {
  _counter++
  return `ej_${Date.now().toString(36)}_${_counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function ensureEmbeddingJob(postId: string): Promise<string> {
  try {
    const existing = await db.embeddingJob.findFirst({
      where: { postId },
      select: { id: true },
    }) as { id: string } | null
    if (existing) return existing.id
    const id = generateId()
    await db.embeddingJob.create({
      data: { id, postId, status: 'pending' },
    })
    return id
  } catch {
    return ''
  }
}

export async function generateEmbeddingWithRetry(
  postId: string,
  title: string,
  textContent: string,
  maxRetries = 3
): Promise<number[]> {
  const textForEmbedding = (title + ' ' + textContent).substring(0, 8000)

  // Ensure job tracking
  const jobId = await ensureEmbeddingJob(postId)

  // Create pipeline execution for tracking
  const executionId = await createPipelineExecution(
    'embedding',
    title.substring(0, 200),
    postId,
    maxRetries
  )

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const embedding = await Promise.race([
        getEmbedding(textForEmbedding),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ])

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned')
      }

      // Update post with embedding
      await db.post.update({
        where: { id: postId },
        data: { embedding },
      } as any)

      // Mark job as generated
      if (jobId) {
        await db.embeddingJob.update({
          where: { id: jobId },
          data: {
            status: 'generated',
            attempts: attempt + 1,
            lastAttemptAt: new Date().toISOString(),
            dimensions: embedding.length,
            errorMessage: null,
          },
        })
      }

      await markPipelineSuccess(executionId, `Generated ${embedding.length}-dim embedding`)
      return embedding
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Do not retry auth errors
      if (msg.includes('401') || msg.includes('403') || msg.includes('API key not configured')) {
        await markPipelineFailed(executionId, msg)
        throw e
      }
      if (attempt >= maxRetries) {
        // Final failure
        if (jobId) {
          await db.embeddingJob.update({
            where: { id: jobId },
            data: {
              status: 'failed',
              attempts: attempt + 1,
              lastAttemptAt: new Date().toISOString(),
              errorMessage: msg,
            },
          })
        }
        await markPipelineFailed(executionId, msg)
        throw e
      }
      // Exponential backoff
      const delay = 1000 * Math.pow(2, attempt)
      console.warn(`[embedding] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${msg}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  return []
}

export async function getPendingEmbeddingJobs(limit = 50): Promise<string[]> {
  try {
    const jobs = await db.embeddingJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) as { postId: string }[]
    return (jobs || []).map((j: any) => j.postId)
  } catch {
    return []
  }
}
