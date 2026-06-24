import { getCommentPrompt } from './persona-comments'
import { validateContent } from '@/lib/encoding'
import type { AtmosphereAction, AiCommentContext } from './types'

const DEEPSEEK_BASE = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''

async function callDeepSeek(
  messages: { role: string; content: string }[],
  maxTokens = 256
): Promise<string> {
  if (!DEEPSEEK_KEY) return ''
  try {
    const res = await fetch(DEEPSEEK_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.8,
        max_tokens: maxTokens,
        stream: false,
        messages,
      }),
    })
    if (!res.ok) {
      console.warn('[atmosphere] DeepSeek error:', res.status)
      return ''
    }
    const json = await res.json()
    return json.choices?.[0]?.message?.content || ''
  } catch (e) {
    console.warn('[atmosphere] DeepSeek fetch error:', e)
    return ''
  }
}

/**
 * Build the user message with post context and existing discussion.
 */
function buildContextMessage(action: AtmosphereAction): string {
  const parts: string[] = []
  parts.push(`文章标题：${action.postTitle}`)

  // Extract first ~600 chars of post content
  try {
    const parsed = typeof action.postContent === 'string'
      ? JSON.parse(action.postContent)
      : action.postContent
    const text = (parsed as any)?.blocks
      ?.map((b: any) => b.data?.text || '')
      .join('\n')
      .slice(0, 600) || ''
    if (text) parts.push(`文章摘要：${text}`)
  } catch {
    parts.push(`文章内容：${String(action.postContent).slice(0, 600)}`)
  }

  // Include existing AI comments for context
  if (action.existingAiComments.length > 0) {
    const recentComments = action.existingAiComments.slice(-5)
    parts.push('\n已有讨论：')
    for (const c of recentComments) {
      parts.push(`[${c.authorRole}]：${c.text.slice(0, 150)}`)
    }
  }

  // For replies, highlight the target comment
  if (action.style === 'reply' && action.replyToCommentText) {
    parts.push(`\n你要回复的是 [${action.replyToAuthorRole}] 的评论：${action.replyToCommentText}`)
  }

  return parts.join('\n')
}

/** Fallback templates when DeepSeek API is unavailable */
function getFallbackComment(action: AtmosphereAction): string {
  const fallbacks: Record<string, string[]> = {
    Newton: [
      '这篇文章的角度很有意思！从数据上看，这个话题还有很多值得深挖的地方。大家觉得这个趋势会怎么发展？',
      '写得很到位，特别是提到的方法论部分。我在备考的时候也发现过类似的问题，有没有人遇到过同样的情况？',
    ],
    Midas: [
      '干货！从搜索趋势来看，这个话题最近热度一直在涨。推荐大家用 Google Trends 关注一下相关关键词的搜索量变化。',
      '实操角度补充一下：除了文章提到的方法，还可以试试 SEMrush 的相关词分析，能找到不少别人忽略的长尾词。',
    ],
    Flora: [
      '大家讨论得好深入啊！作为一个经常在这潜水的人，感觉学到了很多。有没有跟我一样被种草的小伙伴 🙋',
      '太喜欢看大家的讨论了，每个人都有自己的角度。走过的路过的，别光看呀，也分享下你的经历呗～',
    ],
  }

  const pool = fallbacks[action.role] || fallbacks.Flora
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Generate a single AI comment via DeepSeek.
 * Falls back to template if API fails.
 */
export async function generateComment(
  action: AtmosphereAction
): Promise<string> {
  const systemPrompt = getCommentPrompt(action.role, action.style === 'reply')
  const contextMessage = buildContextMessage(action)

  if (!DEEPSEEK_KEY) {
    console.warn('[atmosphere] DEEPSEEK_API_KEY not configured, using fallback')
    return getFallbackComment(action)
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextMessage },
  ]

  const raw = await callDeepSeek(messages, 256)

  if (!raw) {
    console.warn('[atmosphere] DeepSeek returned empty, using fallback')
    return getFallbackComment(action)
  }

  // Validate and clean the generated text
  const validated = validateContent(raw, 'atmosphere-comment')
  if (!validated.valid || !validated.text.trim()) {
    console.warn('[atmosphere] Comment validation failed:', validated.warning)
    return getFallbackComment(action)
  }

  return validated.text.trim()
}
