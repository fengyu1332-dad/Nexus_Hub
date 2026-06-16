// ── Trie Node ─────────────────────────────────────────────

class TrieNode {
  children = new Map<string, TrieNode>()
  isEnd = false
  word: string | null = null
}

// ── Sensitive Word Trie ───────────────────────────────────

class SensitiveWordTrie {
  private root = new TrieNode()

  insert(word: string) {
    const w = word.trim().toLowerCase()
    if (!w) return
    let node = this.root
    for (const ch of w) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode())
      }
      node = node.children.get(ch)!
    }
    node.isEnd = true
    node.word = w
  }

  /** Return all matched sensitive words found in text */
  search(text: string): string[] {
    const normalized = text.toLowerCase()
    const found: string[] = []
    for (let i = 0; i < normalized.length; i++) {
      let node = this.root
      for (let j = i; j < normalized.length; j++) {
        const ch = normalized[j]
        if (!node.children.has(ch)) break
        node = node.children.get(ch)!
        if (node.isEnd && node.word) {
          found.push(node.word)
        }
      }
    }
    return [...new Set(found)]
  }

  containsAny(text: string): boolean {
    const normalized = text.toLowerCase()
    for (let i = 0; i < normalized.length; i++) {
      let node = this.root
      for (let j = i; j < normalized.length; j++) {
        const ch = normalized[j]
        if (!node.children.has(ch)) break
        node = node.children.get(ch)!
        if (node.isEnd) return true
      }
    }
    return false
  }

  replace(text: string, replacement = '***'): string {
    let result = ''
    const normalized = text.toLowerCase()
    let i = 0
    while (i < text.length) {
      let node = this.root
      let longest = -1
      for (let j = i; j < text.length; j++) {
        const ch = normalized[j]
        if (!node.children.has(ch)) break
        node = node.children.get(ch)!
        if (node.isEnd) longest = j
      }
      if (longest >= 0) {
        result += replacement
        i = longest + 1
      } else {
        result += text[i]
        i++
      }
    }
    return result
  }
}

// ── Default sensitive word list ───────────────────────────

const DEFAULT_SENSITIVE_WORDS: string[] = [
  // Spam/advertising patterns
  '加微信', '加我微信', '加qq', '加我qq', '扫码加', '免费领取',
  '日赚', '兼职日结', '刷单', '代理加盟', '微商',
  // Gambling
  '赌博', '博彩', '赌场', '下注', '庄家', '赔率',
  // Pornographic
  '色情', '裸聊', '约炮', '一夜情',
  // Violence/hate
  '暴力', '恐怖主义',
  // Scam
  '代考', '枪手', '作弊', '办假证', '学历造假',
]

// ── Singleton ─────────────────────────────────────────────

let trieInstance: SensitiveWordTrie | null = null

export function getSensitiveWordFilter(): SensitiveWordTrie {
  if (!trieInstance) {
    trieInstance = new SensitiveWordTrie()
    // Load from env if configured
    const envWords = process.env.MODERATION_WORD_LIST
    const words = envWords
      ? envWords.split(/[,，\n]+/).filter(Boolean)
      : DEFAULT_SENSITIVE_WORDS
    for (const w of words) {
      trieInstance.insert(w.trim())
    }
  }
  return trieInstance
}

/** Reset the trie (useful for testing or runtime config update) */
export function resetSensitiveWordFilter() {
  trieInstance = null
}

// ── Content Quality Check (DeepSeek) ──────────────────────

export interface ModerationResult {
  passed: boolean
  flags: string[]
  sensitiveWords: string[]
  score: number
  suggestion?: string
}

const MODERATION_SYSTEM_PROMPT = `你是一个中文留学论坛的内容审核员。请分析以下文本：

检查项：
1. 诈骗/广告：推广链接、传销话术、"加微信/QQ"拉群、商业广告
2. 低质量内容：纯表情/符号刷屏、无意义回复（如"顶""沙发""学习了"）、单字回复
3. 偏离主题：在留学论坛发布与教育/申请无关的内容

请只返回一个JSON对象（不要markdown代码块）：
{"passed": true/false, "flags": ["具体问题1","具体问题2"], "score": 0-100}
- passed: true表示内容可以通过
- flags: 如果passed为false，列出具体问题
- score: 0-100，分数越高表示越有问题（0=完美，100=严重违规）`

export async function checkContentQuality(
  text: string,
  context?: string
): Promise<ModerationResult> {
  // Phase 1: Trie-based sensitive word check (fast, no API call)
  const trie = getSensitiveWordFilter()
  const sensitiveWords = trie.search(text)

  if (sensitiveWords.length > 0) {
    return {
      passed: false,
      flags: sensitiveWords.map((w) => `包含敏感词: ${w}`),
      sensitiveWords,
      score: 100,
      suggestion: '请移除敏感词或广告内容后重试',
    }
  }

  // Phase 2: DeepSeek quality check (if API key is configured)
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    // No AI moderation available — pass with warning
    return { passed: true, flags: [], sensitiveWords: [], score: 0 }
  }

  try {
    const apiBase =
      process.env.DEEPSEEK_API_BASE ||
      'https://api.deepseek.com/chat/completions'
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

    let userMessage = `待审核文本：\n"""\n${text.substring(0, 2000)}\n"""\n`
    if (context) {
      userMessage += `\n上下文：${context}`
    }

    const res = await fetch(apiBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 256,
        stream: false,
        messages: [
          { role: 'system', content: MODERATION_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!res.ok) {
      console.warn('[moderation] DeepSeek API error:', res.status)
      return { passed: true, flags: [], sensitiveWords: [], score: 0 }
    }

    const json = await res.json()
    const raw = json.choices?.[0]?.message?.content || ''

    // Robust JSON extraction
    let parsed: any = null
    try {
      // Try direct parse
      parsed = JSON.parse(raw)
    } catch {
      // Try extracting from markdown code block
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          parsed = JSON.parse(match[0])
        } catch {
          // ignore
        }
      }
    }

    if (parsed && typeof parsed.passed === 'boolean') {
      return {
        passed: parsed.passed,
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        sensitiveWords: [],
        score: typeof parsed.score === 'number' ? parsed.score : 0,
        suggestion: parsed.passed
          ? undefined
          : '内容可能不符合社区规范，请修改后重试',
      }
    }

    // Couldn't parse — pass
    return { passed: true, flags: [], sensitiveWords: [], score: 0 }
  } catch (e) {
    console.warn('[moderation] Quality check failed:', e)
    return { passed: true, flags: [], sensitiveWords: [], score: 0 }
  }
}
