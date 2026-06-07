import { db } from '@/lib/db'
import { cosineSimilarity, semanticSearch } from '@/lib/embedding'
import {
  FLORA_SYSTEM_PROMPT,
  buildFloraContext,
  buildFloraUserMessage,
} from '@/lib/flora'
import {
  checkRateLimit,
  getClientIP,
  rateLimitResponse,
} from '@/lib/rate-limiter'
import { z } from 'zod'

const ChatValidator = z.object({
  message: z.string().min(1).max(2000),
})

// ── Embedding API 调用 ─────────────────────────────────────

async function getEmbedding(text: string): Promise<number[]> {
  // EMBEDDING_API_KEY → DEEPSEEK_API_KEY 链式回退
  const apiKey =
    process.env.EMBEDDING_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY
  const apiBase =
    process.env.EMBEDDING_API_BASE ||
    'https://api.deepseek.com/v1/embeddings'
  const model = process.env.EMBEDDING_MODEL || 'deepseek-chat'

  if (!apiKey) {
    throw new Error('Embedding API key not configured')
  }

  const res = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Embedding API error: ${res.status} ${err}`)
  }

  const json = await res.json()
  return json.data?.[0]?.embedding || []
}

// ── 关键词检索（无 Embedding 时的降级方案） ──────────────────

async function keywordSearch(query: string, topK = 3) {
  const posts = await db.$queryRawUnsafe<
    { id: string; title: string; content: unknown; embedding: unknown }[]
  >(`SELECT "id", "title", "content", "embedding" FROM "Post" WHERE "embedding" IS NOT NULL LIMIT 50`)

  // 简单的 TF 关键词匹配
  const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 1)

  const scored = posts
    .map((post) => {
      const title = (post.title || '').toLowerCase()
      const content =
        typeof post.content === 'string'
          ? post.content.toLowerCase()
          : JSON.stringify(post.content).toLowerCase()
      let score = 0
      for (const kw of keywords) {
        if (title.includes(kw)) score += 3
        const matches = content.split(kw).length - 1
        score += matches
      }
      return { ...post, _score: score }
    })
    .filter((p) => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, topK)

  return scored.map((p) => ({
    postId: p.id,
    title: p.title,
    content:
      typeof p.content === 'string'
        ? p.content
        : JSON.stringify(p.content),
    similarity: Math.min(1, p._score / 10),
  }))
}

// ── 语义检索 ──────────────────────────────────────────────

async function semanticRetrieval(query: string, topK = 3) {
  // 尝试获取 embedding
  let queryEmbedding: number[] | null = null
  try {
    queryEmbedding = await getEmbedding(query)
  } catch {
    // 降级到关键词搜索
    return keywordSearch(query, topK)
  }

  // 获取所有有 embedding 的帖子
  const posts = await db.$queryRawUnsafe<
    { id: string; title: string; content: unknown; embedding: unknown }[]
  >(
    `SELECT "id", "title", "content", "embedding" FROM "Post" WHERE "embedding" IS NOT NULL LIMIT 100`
  )

  if (!posts || posts.length === 0) {
    return keywordSearch(query, topK)
  }

  // 解析 embedding 并计算相似度
  const parsed = posts
    .map((p) => {
      try {
        const emb =
          typeof p.embedding === 'string'
            ? JSON.parse(p.embedding)
            : p.embedding
        if (!Array.isArray(emb) || emb.length === 0) return null
        return {
          postId: p.id,
          title: p.title,
          content:
            typeof p.content === 'string'
              ? p.content
              : JSON.stringify(p.content),
          embedding: emb as number[],
        }
      } catch {
        return null
      }
    })
    .filter(Boolean) as {
    postId: string
    title: string
    content: string
    embedding: number[]
  }[]

  if (parsed.length === 0) {
    return keywordSearch(query, topK)
  }

  return semanticSearch(queryEmbedding, parsed, topK)
}

// ── DeepSeek 调用 ──────────────────────────────────────────

async function chatWithFlora(
  message: string,
  context: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const apiBase =
    process.env.DEEPSEEK_API_BASE ||
    'https://api.deepseek.com/chat/completions'
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

  if (!apiKey) {
    // 无 API Key 时的降级回复 — 对明显越界问题做边界提示
    const offTopicKeywords = [
      '修理', '拖拉机', '天气', '比特币', '股票', '爬虫', '代码',
      '游戏', '外卖', '快递', '直播', '美妆', '减肥',
    ]
    const isOffTopic = offTopicKeywords.some((kw) => message.includes(kw))

    if (isOffTopic) {
      return `嗨～我是 Flora 学姐！🌸\n\n你的问题似乎**不在我的专业范围内**哦。我主要负责解答关于：\n- 📚 国际课程选课与备考（A-Level / AP / IB）\n- 🎓 英美本科申请策略\n- 🏆 学术竞赛规划\n- 💬 留学压力与心理调适\n\n不过，即使是在我的专业领域内，目前 DeepSeek API 还没有配置好，我暂时还无法提供智能回复。\n\n> 💡 提示：在 \`.env\` 中设置 \`DEEPSEEK_API_KEY\` 即可启用完整 AI 能力。`
    }

    return `嗨～我是 Flora 学姐！🌸\n\n我注意到 DeepSeek API 还没有配置好。等管理员配置好 API Key 之后，我就可以帮你解答关于 **学术规划、申请策略、竞赛备考** 等各种问题了！\n\n> 💡 提示：在 \`.env\` 中设置 \`DEEPSEEK_API_KEY\` 即可启用智能回复。`
  }

  const res = await fetch(apiBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: FLORA_SYSTEM_PROMPT },
        { role: 'user', content: buildFloraUserMessage(message, context) },
      ],
    }),
  })

  if (!res.ok) {
    return `抱歉，我的大脑暂时掉线了 😢 (API 返回 ${res.status})。请稍后再试～`
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content || '嗯...让我想想再回答你 🌸'
}

// ── Route Handler ──────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // ── 神盾协议: 速率限制 ──────────────────────────────
    const clientIP = getClientIP(req)
    const limitResult = checkRateLimit(clientIP)
    if (!limitResult.allowed) {
      return rateLimitResponse(limitResult)
    }

    const body = await req.json()
    const { message } = ChatValidator.parse(body)

    // 1. 语义检索 top-3 相关文章
    const retrieved = await semanticRetrieval(message, 3)

    // 2. 构建上下文
    const context = buildFloraContext(retrieved)

    // 3. 调用 DeepSeek 生成回复
    const reply = await chatWithFlora(message, context)

    // 4. 返回
    return new Response(
      JSON.stringify({
        reply,
        sources: retrieved.map((r) => ({
          title: r.title,
          postId: r.postId,
          similarity: r.similarity,
        })),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': String(limitResult.remaining),
          'X-RateLimit-Reset': String(Math.ceil(limitResult.resetAt / 1000)),
        },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }
    console.error('[flora-chat] Error:', error)
    return new Response('Could not process chat message', { status: 500 })
  }
}
