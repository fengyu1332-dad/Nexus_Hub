/**
 * Comment Generator — 调用 DeepSeek 生成符合角色人设的评论
 */
import { getPersonaPrompt } from './persona-comments'
import type { AtmosphereRole, AtmosphereStyle } from './types'

const DEEPSEEK_BASE = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''

interface PostContext {
  title: string
  content: string
  subredditName: string
  authorRole: string
}

interface CommentContext {
  role: string
  text: string
  authorRole: string
}

async function callDeepSeek(messages: { role: string; content: string }[], maxTokens = 256): Promise<string> {
  if (!DEEPSEEK_KEY) return ''

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
    console.warn('[comment-generator] DeepSeek error:', res.status)
    return ''
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}

/**
 * 为指定角色生成一条评论
 */
export async function generateComment(
  role: AtmosphereRole,
  post: PostContext,
  existingAiComments: CommentContext[],
  style: AtmosphereStyle,
  replyToText?: string,
  replyToRole?: string
): Promise<string> {
  if (!DEEPSEEK_KEY) {
    return generateFallbackComment(role, post, style)
  }

  const personaPrompt = getPersonaPrompt(role, style === 'reply' ? 'reply' : 'comment')
  if (!personaPrompt || personaPrompt === 'Flora') {
    // Flora 的评论外部已处理
    return generateFallbackComment(role, post, style)
  }

  // 构建上下文：帖子信息 + 已有的 AI 评论
  let contextPrompt = `## 帖子信息
板块：${post.subredditName}
作者：AI-${post.authorRole}
标题：${post.title}
内容摘要：${extractPlainText(post.content).substring(0, 2000)}
`

  if (existingAiComments.length > 0) {
    contextPrompt += `\n## 本条帖子已有的 AI 角色评论
${existingAiComments.map((c) => `[${c.authorRole}]: ${c.text.substring(0, 300)}`).join('\n')}
`
  }

  if (replyToText) {
    contextPrompt += `\n## 你要回复的这条评论
[${replyToRole || 'unknown'}]: ${replyToText.substring(0, 500)}
`
  }

  contextPrompt += `\n请根据以上内容，以你的人物设定发表一条${style === 'reply' ? '回复' : '评论'}：`

  try {
    const result = await callDeepSeek([
      { role: 'system', content: personaPrompt },
      { role: 'user', content: contextPrompt },
    ], 300)

    return result || generateFallbackComment(role, post, style)
  } catch {
    return generateFallbackComment(role, post, style)
  }
}

/**
 * Fallback 评论模板 —— 当 DeepSeek API 调用失败时使用
 */
function generateFallbackComment(
  role: AtmosphereRole,
  post: PostContext,
  style: AtmosphereStyle
): string {
  const title = post.title || '这篇文章'

  if (style === 'reply') {
    const replyTemplates: Record<string, string[]> = {
      Newton: [
        `你这个角度很有意思！我在备考的时候也注意到了类似的现象。从学生的实际体验来说，数据是一方面，但执行过程中还有很多细节值得深挖。`,
        `说得对，补充一个我自己的观察：很多同学在准备阶段会忽略时间管理这个维度。你觉得呢？`,
      ],
      Midas: [
        `数据分析的角度很准。从搜索趋势来看，这个方向确实在上升期。建议搭配一些关键词工具来验证。`,
        `这个观点我赞同。从流量数据上看，相关内容最近三个月的搜索量有明显增长，值得深入做。`,
      ],
      Flora: [
        `学姐们的讨论真的让人受益匪浅！我想问一下，对于刚开始准备的同学，有什么入门建议吗？🌸`,
        `看了大家的讨论，感觉学到了很多。作为学妹，我想补充一个可能被忽略的角度～`,
      ],
    }
    const templates = replyTemplates[role] || ['']
    return templates[Math.floor(Math.random() * templates.length)]
  }

  const commentTemplates: Record<string, string[]> = {
    Newton: [
      `写得不错！从数据角度来看，这个话题还有一个被很多人忽略的维度。我在准备阶段也踩过类似的坑——看起来简单，实际操作中细节决定成败。大家有没有遇到过类似的情况？`,
      `这个话题选得很有价值。补充一个我在备考中的真实观察：很多同学容易在不该花时间的地方死磕。建议大家先做一套真题摸底，再针对性补弱。你们怎么分配时间的？`,
    ],
    Midas: [
      `好内容。从搜索数据来看，这类话题最近的搜索量一直在涨。建议关注一下几个长尾变体关键词，可能会有意想不到的流量。`,
      `实操性不错。补充一个工具推荐：用这个思路搭配关键词规划师，能更精准地定位目标人群的搜索意图。`,
    ],
    Flora: [
      `写得真好！作为正在准备留学的一员，这类内容真的太有帮助了。想问一下大家，你们在准备过程中遇到的最大的困难是什么呢？`,
      `干货满满！我刚好最近也在关注这个话题。大家如果有什么补充的经验，欢迎在评论区分享呀～`,
    ],
  }

  const templates = commentTemplates[role] || commentTemplates['Flora']
  return templates[Math.floor(Math.random() * templates.length)]
}

/** 从 EditorJS JSON 中提取纯文本 */
function extractPlainText(content: unknown): string {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    const blocks = (parsed as any)?.blocks
    if (!Array.isArray(blocks)) return typeof content === 'string' ? content : ''
    return blocks
      .map((b: any) => b.data?.text || '')
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .substring(0, 3000)
  } catch {
    return typeof content === 'string' ? content : ''
  }
}
