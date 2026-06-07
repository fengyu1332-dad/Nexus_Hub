import { db } from '@/lib/db'
import { z } from 'zod'

const EmbeddingUpdateValidator = z.object({
  postId: z.string().min(1),
  embedding: z.array(z.number()).length(1536),
  model: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ── 1. 校验身份 ──────────────────────────────────────────
    const secretKey = body.secret_key || req.headers.get('x-api-key')
    if (secretKey !== process.env.AI_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    // ── 2. 校验 Payload ──────────────────────────────────────
    const { postId, embedding, model } =
      EmbeddingUpdateValidator.parse(body)

    // ── 3. 检查 Post 是否存在 ─────────────────────────────────
    const existing = await db.post.findUnique({
      where: { id: postId },
      select: { id: true },
    })
    if (!existing) {
      return new Response(`Post "${postId}" not found`, { status: 404 })
    }

    // ── 4. UPDATE embedding 字段 (原生 SQL，直接写 JSONB) ────
    await db.$executeRawUnsafe(
      `UPDATE "Post" SET "embedding" = $1::jsonb WHERE "id" = $2`,
      JSON.stringify(embedding),
      postId
    )

    // ── 5. 返回 200 ──────────────────────────────────────────
    return new Response(
      JSON.stringify({
        postId,
        dimensions: embedding.length,
        model: model || 'text-embedding-3-small',
        stored: true,
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
    console.error('[embedding] Unexpected error:', error)
    return new Response('Could not store embedding', { status: 500 })
  }
}

/**
 * GET: 检索某篇文章的 Embedding 向量（供 RAG 相似度检索使用）
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('postId')

    if (!postId) {
      return new Response('Missing postId parameter', { status: 400 })
    }

    const rows = await db.$queryRawUnsafe<{ id: string; title: string; embedding: unknown }[]>(
      `SELECT "id", "title", "embedding" FROM "Post" WHERE "id" = $1`,
      postId
    )

    if (!rows || rows.length === 0) {
      return new Response('Post not found', { status: 404 })
    }

    const post = rows[0]

    return new Response(
      JSON.stringify({
        postId: post.id,
        title: post.title,
        embedding: post.embedding,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[embedding] GET error:', error)
    return new Response('Could not retrieve embedding', { status: 500 })
  }
}
