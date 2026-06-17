/**
 * Nexus Hub — RAG 向量相似度检索工具
 *
 * 使用余弦相似度 (Cosine Similarity) 在没有 pgvector 的情况下
 * 对 Json 存储的 embedding 向量进行最近邻检索。
 *
 * 公式: cos(θ) = (A·B) / (‖A‖ × ‖B‖)
 */

// ── 向量基础运算 ──────────────────────────────────────────

/** 向量点积 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`)
  }
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i]
  }
  return sum
}

/** 向量 L2 范数 */
export function norm(a: number[]): number {
  let sum = 0
  for (const v of a) {
    sum += v * v
  }
  return Math.sqrt(sum)
}

/** 余弦相似度 [-1, 1]，越接近 1 越相似 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = dotProduct(a, b)
  const normA = norm(a)
  const normB = norm(b)
  if (normA === 0 || normB === 0) return 0
  return dot / (normA * normB)
}

// ── 内容切片 (Chunking) ───────────────────────────────────

/**
 * 将 Markdown 文本按语义边界切分为固定大小的块。
 * 每个块保持 ~500 tokens (约 1000 字符)，以 ## 标题或空行为边界。
 */
export function chunkMarkdown(
  markdown: string,
  maxChunkSize = 1000
): string[] {
  const chunks: string[] = []

  // 首先按 H2 标题分割
  const sections = markdown.split(/(?=^## )/m)

  for (const section of sections) {
    if (section.length <= maxChunkSize) {
      if (section.trim()) chunks.push(section.trim())
    } else {
      // 按段落进一步切割
      const paragraphs = section.split(/\n\n+/)
      let current = ''
      for (const p of paragraphs) {
        if ((current + p).length > maxChunkSize && current) {
          chunks.push(current.trim())
          current = p
        } else {
          current += (current ? '\n\n' : '') + p
        }
      }
      if (current.trim()) chunks.push(current.trim())
    }
  }

  return chunks.filter((c) => c.length > 50) // 过滤太短的块
}

// ── Embedding API 调用 ─────────────────────────────────────

/**
 * 调用 Embedding API 生成文本向量。
 * 需要配置 EMBEDDING_API_KEY（OpenAI 兼容接口）。
 * API key 缺失时返回空数组（优雅降级），其他错误抛出异常。
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.EMBEDDING_API_KEY
  if (!apiKey) {
    console.warn('[embedding] EMBEDDING_API_KEY not configured — returning empty embedding')
    return []
  }
  const apiBase =
    process.env.EMBEDDING_API_BASE ||
    'https://api.openai.com/v1/embeddings'
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'

  const res = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text.substring(0, 8000) }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error: ${res.status} ${err}`)
  }

  const json = await res.json()
  return json.data?.[0]?.embedding || []
}

/**
 * 带重试的嵌入生成。指数退避：1s, 2s, 4s。
 * 401/403 不重试（认证错误重试无意义）。
 * 超时 10s/次。
 */
export async function getEmbeddingWithRetry(
  text: string,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<number[]> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const apiKey = process.env.EMBEDDING_API_KEY
      if (!apiKey) {
        console.warn('[embedding] EMBEDDING_API_KEY not configured — skipping')
        return []
      }

      const apiBase =
        process.env.EMBEDDING_API_BASE ||
        'https://api.openai.com/v1/embeddings'
      const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'

      const res = await fetch(apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text.substring(0, 8000) }),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const status = res.status
        // Auth errors — don't retry
        if (status === 401 || status === 403) {
          console.error(`[embedding] Fatal auth error: ${status}`)
          return []
        }
        const errBody = await res.text()
        throw new Error(`Embedding API error: ${status} ${errBody}`)
      }

      const json = await res.json()
      return json.data?.[0]?.embedding || []
    } catch (err: any) {
      lastError = err
      if (err.name === 'AbortError') {
        console.warn(`[embedding] Attempt ${attempt + 1} timed out`)
        lastError = new Error('Request timeout')
      }
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.warn(`[embedding] Retry ${attempt + 1}/${maxRetries} in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }

  console.error(`[embedding] All ${maxRetries + 1} attempts failed:`, lastError?.message)
  return []
}

// ── 检索接口 ─────────────────────────────────────────────

interface EmbeddedChunk {
  postId: string
  title: string
  chunkIndex?: number
  content: string
  similarity: number
}

/**
 * 在已嵌入的文章中检索与 query 最相似的 Top-K 个块。
 *
 * 使用场景：
 * - Flora 客服回答用户问题时检索相关学术内容
 * - 搜索推荐
 *
 * @param queryEmbedding - 查询文本的 embedding 向量
 * @param corpus          - 已预加载的文章块 { postId, title, chunkText, embedding }
 * @param topK            - 返回最相似的 K 个结果
 */
export function semanticSearch(
  queryEmbedding: number[],
  corpus: {
    postId: string
    title: string
    chunkIndex?: number
    content: string
    embedding: number[]
  }[],
  topK = 5
): EmbeddedChunk[] {
  return corpus
    .map((doc) => ({
      postId: doc.postId,
      title: doc.title,
      chunkIndex: doc.chunkIndex,
      content: doc.content,
      similarity: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}
