import { db } from '@/lib/db'
import { getEmbedding, cosineSimilarity } from '@/lib/embedding'

export interface DedupResult {
  isDuplicate: boolean
  score: number
  matchedPost?: {
    id: string
    title: string
    similarity: number
  }
}

const DEFAULT_THRESHOLD = 0.92

export async function checkSemanticDedup(
  title: string,
  content: string,
  options?: {
    threshold?: number
    lookbackDays?: number
    maxCandidates?: number
  }
): Promise<DedupResult> {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD
  const maxCandidates = options?.maxCandidates ?? 50

  try {
    // 1. Generate embedding for new content
    const queryText = (title + ' ' + content).substring(0, 8000)
    let queryEmbedding: number[]

    try {
      queryEmbedding = await getEmbedding(queryText)
      if (!queryEmbedding || queryEmbedding.length === 0) {
        return { isDuplicate: false, score: 0 }
      }
    } catch {
      // No embedding API — skip semantic dedup
      return { isDuplicate: false, score: 0 }
    }

    // 2. Fetch recent posts with embeddings
    const recentPosts = (await db.post.findMany({
      select: { id: true, title: true, content: true, embedding: true },
      orderBy: { createdAt: 'desc' },
      take: maxCandidates,
    })) as { id: string; title: string; content: any; embedding: any }[]

    // 3. Compare embeddings
    let bestMatch: DedupResult['matchedPost'] | undefined
    let bestScore = 0

    for (const p of recentPosts) {
      if (!p.embedding) continue
      let emb: number[]
      try {
        emb = typeof p.embedding === 'string'
          ? JSON.parse(p.embedding)
          : p.embedding
      } catch {
        continue
      }
      if (!Array.isArray(emb) || emb.length === 0) continue

      const score = cosineSimilarity(queryEmbedding, emb)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { id: p.id, title: p.title, similarity: score }
      }
    }

    return {
      isDuplicate: bestScore >= threshold,
      score: bestScore,
      matchedPost: bestScore >= threshold ? bestMatch : undefined,
    }
  } catch (e) {
    console.warn('[semantic-dedup] Check failed:', e)
    return { isDuplicate: false, score: 0 }
  }
}
