import { db } from '@/lib/db'
import { cosineSimilarity } from '@/lib/embedding'
import { getDictionary } from '@/i18n'
import Link from 'next/link'

interface RelatedPostsProps {
  currentPostId: string
  subredditId: string
  subredditName: string
  embedding?: number[] | null
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

export async function RelatedPosts({
  currentPostId,
  subredditId,
  subredditName,
  embedding,
}: RelatedPostsProps) {
  const dict = getDictionary()
  let related: { id: string; title: string; excerpt: string }[] = []

  try {
    if (embedding && embedding.length > 0) {
      // Semantic search: get all posts with embedding, compute similarity
      const allPosts = await db.post.findMany({
        where: { subredditId },
        select: {
          id: true,
          title: true,
          content: true,
          embedding: true,
        },
        take: 30,
      })

      const candidates = (allPosts || [])
        .filter((p: any) => p.id !== currentPostId && p.embedding)
        .map((p: any) => {
          let emb: number[] = []
          try {
            emb = typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding
          } catch { /* skip */ }
          return {
            id: p.id,
            title: p.title,
            excerpt: extractTextFromContent(p.content).substring(0, 150),
            similarity: Array.isArray(emb) && emb.length > 0
              ? cosineSimilarity(embedding, emb)
              : 0,
          }
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3)

      related = candidates
    }

    // Fallback: same-subreddit recent posts
    if (related.length === 0) {
      const recent = await db.post.findMany({
        where: { subredditId },
        select: { id: true, title: true, content: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
      })

      related = (recent || [])
        .filter((p: any) => p.id !== currentPostId)
        .slice(0, 3)
        .map((p: any) => ({
          id: p.id,
          title: p.title,
          excerpt: extractTextFromContent(p.content).substring(0, 150),
        }))
    }
  } catch {
    // DB unavailable — show nothing
  }

  if (related.length === 0) return null

  return (
    <div className='mt-8 pt-6 border-t border-gray-200'>
      <h3 className='font-semibold text-lg mb-4'>{dict.relatedPosts.heading}</h3>
      <div className='grid gap-3 sm:grid-cols-3'>
        {related.map((p) => (
          <Link
            key={p.id}
            href={`/r/${subredditName}/post/${p.id}`}
            className='block bg-white rounded border p-4 hover:border-orange-300 hover:shadow-sm transition-all'
          >
            <h4 className='font-medium text-sm line-clamp-2 hover:text-orange-500'>
              {p.title}
            </h4>
            {p.excerpt && (
              <p className='text-xs text-zinc-500 mt-2 line-clamp-2'>
                {p.excerpt}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
