import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { generateEmbeddingWithRetry } from '@/lib/embedding-job'
import { createPipelineExecution, markPipelineSuccess, markPipelineFailed } from '@/lib/pipeline-logger'
import { NextResponse } from 'next/server'

// GET — return pending embedding job count
export async function GET() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const totalPosts = await db.post.count({ where: { status: 'PUBLISHED' } })

    // Count posts with embeddings
    let withEmbedding = 0
    try {
      const allPosts = await db.post.findMany({
        select: { id: true, embedding: true },
        take: 100000,
      })
      withEmbedding = (allPosts || []).filter(
        (p: any) => p.embedding && Array.isArray(p.embedding) && p.embedding.length > 0
      ).length
    } catch {
      // fallback
    }

    // Count pending/failed embedding jobs
    let pendingJobs = 0
    let failedJobs = 0
    try {
      pendingJobs = await db.embeddingJob.count({ where: { status: 'pending' } })
      failedJobs = await db.embeddingJob.count({ where: { status: 'failed' } })
    } catch {
      // fallback
    }

    return NextResponse.json({
      totalPosts,
      withEmbedding,
      pendingJobs,
      failedJobs,
      coverage: totalPosts > 0 ? Math.round((withEmbedding / totalPosts) * 100) : 0,
    })
  } catch (err: any) {
    console.error('[embedding-backfill] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — backfill up to 50 posts with missing embeddings
export async function POST() {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.EMBEDDING_API_KEY) {
      return NextResponse.json({ error: 'EMBEDDING_API_KEY not configured' }, { status: 400 })
    }

    const execId = await createPipelineExecution('embedding_backfill', 'Batch backfill embeddings', undefined, 1)

    // Find posts without embeddings (published, no embedding or empty embedding)
    const allPosts = await db.post.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, title: true, content: true, embedding: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const needsEmbedding = (allPosts || []).filter(
      (p: any) => !p.embedding || (Array.isArray(p.embedding) && p.embedding.length === 0)
    ).slice(0, 50)

    if (needsEmbedding.length === 0) {
      await markPipelineSuccess(execId, 'No posts need embedding')
      return NextResponse.json({ backfilled: 0, message: 'All posts already have embeddings' })
    }

    let succeeded = 0
    let failed = 0

    for (const post of needsEmbedding) {
      const textContent = extractTextFromContent((post as any).content) || (post as any).title || ''
      try {
        await generateEmbeddingWithRetry((post as any).id, (post as any).title, textContent, 1)
        succeeded++
      } catch {
        failed++
        console.error(`[embedding-backfill] Failed to embed post ${(post as any).id}`)
      }
    }

    const summary = `Backfilled ${succeeded} succeeded, ${failed} failed out of ${needsEmbedding.length} posts`
    await markPipelineSuccess(execId, summary)

    return NextResponse.json({
      backfilled: succeeded,
      failed,
      total: needsEmbedding.length,
      message: summary,
    })
  } catch (err: any) {
    console.error('[embedding-backfill] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function extractTextFromContent(content: unknown): string {
  if (!content) return ''
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    const blocks = (parsed as any)?.blocks
    if (!Array.isArray(blocks)) return ''
    return blocks
      .map((b: any) => b.data?.text || '')
      .join(' ')
      .replace(/<[^>]+>/g, '')
  } catch {
    return typeof content === 'string' ? content : ''
  }
}
