import { db } from '@/lib/db'
import { cosineSimilarity, getEmbedding, semanticSearch } from '@/lib/embedding'
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
import type { DbPost } from '@/lib/types'
import { z } from 'zod'

const ChatValidator = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'flora']),
        content: z.string().max(1000),
      })
    )
    .max(10)
    .optional(),
})

// ── 关键词检索（无 Embedding 时的降级方案） ──────────────────

async function keywordSearch(query: string, topK = 3) {
  const posts = (await db.post.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
  })) as Pick<DbPost, 'id' | 'title' | 'content'>[]

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
  const posts = (await db.post.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
  })) as Pick<DbPost, 'id' | 'title' | 'content' | 'embedding'>[]

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

// ── 无 API Key 降级回复 ──────────────────────────────────

function fallbackReply(message: string): string {
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
    const { message, history } = ChatValidator.parse(body)

    // 1. 语义检索 top-3 相关文章
    const retrieved = await semanticRetrieval(message, 3)

    // 1.5 Batch-resolve subreddit names for source links
    const postIds = retrieved.map((r) => r.postId)
    const subMap = new Map<string, string>()
    if (postIds.length > 0) {
      try {
        const rows = (await db.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, subredditId: true },
        })) as { id: string; subredditId: string }[]
        const subIds = [...new Set(rows.map((r) => r.subredditId))]
        for (const sid of subIds) {
          const sub = await db.subreddit.findFirst({
            where: { id: sid },
            select: { name: true },
          })
          const name = (sub as any)?.name || 'DevShowcase'
          subMap.set(sid, name)
        }
        for (const row of rows) {
          if (subMap.has(row.subredditId)) {
            const item = retrieved.find((r) => r.postId === row.id)
            if (item) (item as any).subredditName = subMap.get(row.subredditId)
          }
        }
      } catch {
        for (const r of retrieved) {
          ;(r as any).subredditName = 'DevShowcase'
        }
      }
    }

    // 2. 构建上下文
    const context = buildFloraContext(retrieved)

    const sources = retrieved.map((r) => ({
      title: r.title,
      postId: r.postId,
      subredditName: (r as any).subredditName || 'DevShowcase',
      similarity: r.similarity,
    }))

    const apiKey = process.env.DEEPSEEK_API_KEY
    const apiBase =
      process.env.DEEPSEEK_API_BASE ||
      'https://api.deepseek.com/chat/completions'
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

    // 无 API Key: 返回降级 SSE 流
    if (!apiKey) {
      const fb = fallbackReply(message)
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder()
          const s = (str: string) => controller.enqueue(enc.encode(str))
          s(`data: ${JSON.stringify({ type: 'sources', data: sources })}\n\n`)
          let i = 0
          const timer = setInterval(() => {
            while (i < fb.length) {
              const chunk = fb.slice(i, i + 3)
              i += chunk.length
              s(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`)
              return
            }
            clearInterval(timer)
            s('data: [DONE]\n\n')
            controller.close()
          }, 30)
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-RateLimit-Remaining': String(limitResult.remaining),
          'X-RateLimit-Reset': String(Math.ceil(limitResult.resetAt / 1000)),
        },
      })
    }

    // 3. 调用 DeepSeek（尝试流式，失败时自动降级为非流式）
    const dsPayload = {
      model,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: FLORA_SYSTEM_PROMPT },
        ...(history || []).map((h: any) => ({
          role: h.role === 'flora' ? ('assistant' as const) : ('user' as const),
          content: h.content,
        })),
        { role: 'user', content: buildFloraUserMessage(message, context) },
      ],
    }

    const dsRes = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(dsPayload),
    })

    if (!dsRes.ok) {
      let errorText = ''
      try { const ej = await dsRes.json(); errorText = ej?.error?.message || '' } catch {}
      return new Response(
        JSON.stringify({
          reply: `抱歉，我的大脑暂时掉线了 😢 (API ${dsRes.status}${errorText ? ': ' + errorText : ''})。请稍后再试～`,
          sources,
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
    }

    // Try true streaming via ReadableStream pipe; fallback to buffered streaming
    const useStreaming = dsRes.body && typeof dsRes.body.getReader === 'function'

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        const s = (str: string) => controller.enqueue(enc.encode(str))
        s(`data: ${JSON.stringify({ type: 'sources', data: sources })}\n\n`)

        if (!useStreaming) {
          // Fallback: read entire response and stream in chunks
          try {
            const json = await dsRes.json()
            const fullReply = json.choices?.[0]?.message?.content || ''
            let i = 0
            const flush = () => {
              while (i < fullReply.length) {
                const chunk = fullReply.slice(i, i + 5)
                i += chunk.length
                s(`data: ${JSON.stringify({ type: 'delta', content: chunk })}\n\n`)
                if (i < fullReply.length) {
                  setTimeout(flush, 15)
                } else {
                  s('data: [DONE]\n\n')
                  controller.close()
                }
                return
              }
              s('data: [DONE]\n\n')
              controller.close()
            }
            flush()
          } catch {
            s('data: [DONE]\n\n')
            controller.close()
          }
          return
        }

        // True streaming: pipe DeepSeek SSE response
        const reader = dsRes.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let lastChunkTime = Date.now()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            lastChunkTime = Date.now()
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data:')) continue
              const data = trimmed.slice(5).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  s(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`)
                }
              } catch { /* skip */ }
            }
          }
        } catch { /* stream error */ }

        s('data: [DONE]\n\n')
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-RateLimit-Remaining': String(limitResult.remaining),
        'X-RateLimit-Reset': String(Math.ceil(limitResult.resetAt / 1000)),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(error.message, { status: 400 })
    }
    console.error('[flora-chat] Error:', error)
    return new Response('Could not process chat message', { status: 500 })
  }
}
