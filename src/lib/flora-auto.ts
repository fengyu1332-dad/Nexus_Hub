/**
 * Flora Auto-Engagement — AI 自动互动引擎
 *
 * 能力：
 *   1. 新 AI 帖子发布后，Flora 自动留第一条评论引导讨论
 *   2. 扫描无回复的用户评论，Flora 判断是否需要回应
 */

const DEEPSEEK_BASE = process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || ''

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
    console.warn('[flora-auto] DeepSeek error:', res.status)
    return ''
  }

  const json = await res.json()
  return json.choices?.[0]?.message?.content || ''
}

// ── 1. 新帖子欢迎评论 ──────────────────────────────────

const WELCOME_COMMENT_PROMPT = `你是 Flora 学姐，Nexus Hub 的常驻学姐。你看到了一篇新发布的文章，请你写一条真诚、自然的评论来引导讨论。

规则：
- 先表达对文章内容的认可或好奇（1句话）
- 提出1个开放性问题，引导读者在评论区分享自己的经验
- 如果文章是攻略/干货类，可以补充一条实用小建议
- 总长度：80-150 字
- 语言风格：温暖、自然，像学姐在跟学弟学妹聊天
- 用中文回复（可以夹杂少量英文术语如 AP、SAT）
- 不要以"大家好"开头，不要用官方公告的语气
- 回复中不要使用 markdown 格式符号`

export async function generateWelcomeComment(
  postTitle: string,
  postSummary: string,
  subredditName: string,
  authorRole: string
): Promise<string> {
  const userMsg = `板块：${subredditName}
作者：AI-${authorRole}
标题：${postTitle}
内容摘要：${postSummary.substring(0, 1500)}

请为这篇文章写一条开场评论：`

  const result = await callDeepSeek([
    { role: 'system', content: WELCOME_COMMENT_PROMPT },
    { role: 'user', content: userMsg },
  ])

  return result || generateFallbackComment(postTitle, subredditName, authorRole)
}

function generateFallbackComment(
  postTitle: string,
  subredditName: string,
  authorRole: string
): string {
  const templates = [
    `写得真好！作为正在准备留学的一员，这类内容真的太有帮助了。想问一下大家，你们在准备过程中遇到的最大的困难是什么呢？`,
    `干货满满！我刚好最近也在关注这个话题。大家如果有什么补充的经验，欢迎在评论区分享呀～`,
    `这个话题确实很重要！文章里提到的几点我都深有体会。你们觉得最关键的是哪一点？`,
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}

// ── 2. 用户评论自动回复 ──────────────────────────────────

const REPLY_DECISION_PROMPT = `你是 Flora 学姐。你会看到一条用户在 Nexus Hub 论坛上的评论。
请判断这条评论是否需要你回复，并给出理由。

需要回复的情况：
- 用户在提问（关于学术、申请、课程等）
- 用户表达了困惑、焦虑等情绪
- 用户在分享经验，你可以鼓励或补充
- 用户明确提到了"Flora"、"学姐"、或 @了你

不需要回复的情况：
- 简单的点赞/支持（"好文章""学习了""感谢分享"）
- 与其他用户之间的对话
- 纯灌水或广告

请只返回一个 JSON 对象：
{"shouldReply": true/false, "reason": "简短理由"}`

const REPLY_GENERATION_PROMPT = `你是 Flora 学姐，Nexus Hub 的树洞客服和学术向导。
现在有一个学生在论坛上发表了评论，请你以学姐的身份回复。

背景信息（如果有）：
{context}

学生的评论：
{comment}

规则：
- 先共情，再回答
- 回复具体、可操作，不空泛
- 长度：50-200 字
- 用中文，风格温暖自然
- 可以适当使用 emoji（1-2个）
- 不编造信息，不懂就说不知道`

export interface CommentToCheck {
  commentId: string
  postTitle: string
  postContent: string
  commentText: string
  authorUsername: string
}

export interface ReplyDecision {
  commentId: string
  shouldReply: boolean
  reason: string
  reply?: string
}

export async function shouldReplyToComment(comment: CommentToCheck): Promise<ReplyDecision> {
  if (!DEEPSEEK_KEY) {
    return { commentId: comment.commentId, shouldReply: false, reason: 'DeepSeek not configured' }
  }

  try {
    const decisionRaw = await callDeepSeek([
      { role: 'system', content: REPLY_DECISION_PROMPT },
      { role: 'user', content: `评论内容：${comment.commentText.substring(0, 500)}` },
    ])

    let decision: { shouldReply: boolean; reason: string } = { shouldReply: false, reason: '' }
    try {
      const match = decisionRaw.match(/\{[\s\S]*\}/)
      if (match) decision = JSON.parse(match[0])
    } catch {
      // If someone explicitly mentions Flora, always reply
      const mentionsFlora = /flora|学姐|Flora/i.test(comment.commentText)
      decision = { shouldReply: mentionsFlora, reason: mentionsFlora ? '@mentioned' : 'parse_failed' }
    }

    if (!decision.shouldReply) {
      return { commentId: comment.commentId, shouldReply: false, reason: decision.reason }
    }

    // Generate the actual reply
    const reply = await callDeepSeek([
      { role: 'system', content: REPLY_GENERATION_PROMPT
        .replace('{context}', `文章标题：${comment.postTitle}\n文章摘要：${comment.postContent.substring(0, 800)}`)
        .replace('{comment}', comment.commentText)
      },
      { role: 'user', content: `请回复这条评论：${comment.commentText.substring(0, 500)}` },
    ], 300)

    return {
      commentId: comment.commentId,
      shouldReply: true,
      reason: decision.reason,
      reply: reply || '好的，我看到了你的评论～有什么具体想了解的吗？',
    }
  } catch {
    return { commentId: comment.commentId, shouldReply: false, reason: 'error' }
  }
}

// ── 3. 提取文章摘要 ─────────────────────────────────────

export function extractPostSummary(content: unknown): string {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    const blocks = (parsed as any)?.blocks
    if (!Array.isArray(blocks)) return ''
    return blocks
      .map((b: any) => b.data?.text || '')
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .substring(0, 1500)
  } catch {
    return typeof content === 'string' ? content.substring(0, 1500) : ''
  }
}
