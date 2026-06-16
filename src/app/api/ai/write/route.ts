import { getAuthSession } from '@/lib/auth'
import {
  checkRateLimit,
  getClientIP,
  rateLimitResponse,
} from '@/lib/rate-limiter'
import { z } from 'zod'

const WriteValidator = z.object({
  text: z.string().min(1).max(8000),
  action: z.enum(['polish', 'expand', 'summarize']),
  context: z.string().max(2000).optional(),
  style: z.enum(['academic', 'casual', 'professional']).optional().default('academic'),
})

const SYSTEM_PROMPTS: Record<string, string> = {
  polish:
    '你是一个中文留学论坛的写作助手。请润色以下文字：修正语法错误、改善流畅度、使其更具吸引力。保持原意和语气。只输出润色后的文本，不要加任何说明。',
  expand:
    '你是一个中文留学论坛的写作助手。请扩写以下文字，增加更多细节、例子或解释。保持原文风格。只输出扩写后的文本，不要加任何说明。',
  summarize:
    '你是一个中文留学论坛的写作助手。请简洁地总结以下文字，保留关键信息点。只输出总结后的文本，不要加任何说明。',
}

const STYLE_MODIFIERS: Record<string, string> = {
  academic: '使用学术严谨的语气。',
  casual: '使用口语化、轻松的语气。',
  professional: '使用专业、正式的语气。',
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const clientIP = getClientIP(req)
    const limitResult = checkRateLimit(clientIP)
    if (!limitResult.allowed) {
      return rateLimitResponse(limitResult)
    }

    const body = await req.json()
    const { text, action, context, style } = WriteValidator.parse(body)

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const apiBase =
      process.env.DEEPSEEK_API_BASE ||
      'https://api.deepseek.com/chat/completions'
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

    const systemPrompt = SYSTEM_PROMPTS[action] + ' ' + STYLE_MODIFIERS[style]
    let userMessage = `文本：\n"""\n${text}\n"""\n`
    if (context) {
      userMessage += `\n上下文（仅供参考，不需要处理）：\n"""\n${context}\n"""\n`
    }

    const dsRes = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: action === 'expand' ? 4096 : 2048,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!dsRes.ok) {
      return new Response(
        JSON.stringify({ error: `AI API error: ${dsRes.status}` }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const dsJson = await dsRes.json()
    const result = dsJson.choices?.[0]?.message?.content || ''

    return new Response(
      JSON.stringify({
        result,
        action,
        inputLength: text.length,
        outputLength: result.length,
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
    console.error('[ai-write] Error:', error)
    return new Response('Could not process writing request', { status: 500 })
  }
}
