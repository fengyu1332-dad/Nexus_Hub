import { db } from '@/lib/db'

let _counter = 0
function generateId(): string {
  _counter++
  return `pl_${Date.now().toString(36)}_${_counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export type PipelineType = 'ai_publish' | 'embedding' | 'flora_auto_reply' | 'crawl' | 'dedup_check' | 'tag_classify' | 'semantic_search' | 'embedding_backfill' | 'newsletter_send' | 'atmosphere_builder'
export type PipelineStatus = 'pending' | 'running' | 'success' | 'failed' | 'dead_letter'

export async function createPipelineExecution(
  pipelineType: PipelineType,
  inputSummary: string,
  entityId?: string,
  maxRetries = 3
): Promise<string> {
  const id = generateId()
  try {
    await db.pipelineExecution.create({
      data: {
        id,
        pipelineType,
        status: 'running',
        entityId: entityId || null,
        inputSummary: inputSummary.substring(0, 500),
        startedAt: new Date().toISOString(),
        maxRetries,
      },
    })
  } catch {
    console.warn(`[pipeline-logger] Failed to create execution for ${pipelineType}:${id}`)
  }
  return id
}

export async function markPipelineSuccess(
  executionId: string,
  outputSummary?: string
): Promise<void> {
  try {
    const now = new Date().toISOString()
    // Find the record to calculate duration
    const record = await db.pipelineExecution.findFirst({
      where: { id: executionId },
      select: { startedAt: true },
    }) as { startedAt?: string } | null
    const startedAt = record?.startedAt ? new Date(record.startedAt).getTime() : Date.now()
    const durationMs = Date.now() - startedAt

    await db.pipelineExecution.update({
      where: { id: executionId },
      data: {
        status: 'success',
        outputSummary: outputSummary?.substring(0, 500) || null,
        completedAt: now,
        durationMs,
      },
    })
  } catch {
    console.warn(`[pipeline-logger] Failed to mark success for ${executionId}`)
  }
}

export async function markPipelineFailed(
  executionId: string,
  errorMessage: string
): Promise<void> {
  try {
    const record = await db.pipelineExecution.findFirst({
      where: { id: executionId },
      select: { retryCount: true, maxRetries: true, startedAt: true },
    }) as { retryCount?: number; maxRetries?: number; startedAt?: string } | null

    const retryCount = (record?.retryCount ?? 0) + 1
    const maxRetries = record?.maxRetries ?? 3
    const newStatus: PipelineStatus = retryCount >= maxRetries ? 'dead_letter' : 'failed'
    const startedAt = record?.startedAt ? new Date(record.startedAt).getTime() : Date.now()
    const durationMs = Date.now() - startedAt

    await db.pipelineExecution.update({
      where: { id: executionId },
      data: {
        status: newStatus,
        errorMessage: errorMessage.substring(0, 1000),
        retryCount,
        completedAt: new Date().toISOString(),
        durationMs,
      },
    })
  } catch {
    console.warn(`[pipeline-logger] Failed to mark failure for ${executionId}`)
  }
}

export async function incrementPipelineRetry(executionId: string): Promise<void> {
  try {
    const record = await db.pipelineExecution.findFirst({
      where: { id: executionId },
      select: { retryCount: true },
    }) as { retryCount?: number } | null
    await db.pipelineExecution.update({
      where: { id: executionId },
      data: {
        retryCount: (record?.retryCount ?? 0) + 1,
        status: 'running',
      },
    })
  } catch {
    console.warn(`[pipeline-logger] Failed to increment retry for ${executionId}`)
  }
}
