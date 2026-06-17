import { db } from '@/lib/db'

// ── Default keyword-to-tag mapping ──────────────────────────

const DEFAULT_TAG_RULES: Record<string, string[]> = {
  'AP|Advanced Placement': ['APExams', 'AP备考'],
  'A-Level|ALevel|A Level': ['ALevel', 'A-Level备考'],
  'IB|International Baccalaureate': ['IBDiploma', 'IB备考'],
  'SAT|SAT考试': ['SATPrep', 'SAT备考'],
  'ACT|ACT考试': ['ACTPrep', 'ACT备考'],
  'TOEFL|托福': ['TOEFL', '语言考试'],
  'IELTS|雅思': ['IELTS', '语言考试'],
  '牛剑|Oxbridge|牛津|剑桥': ['Oxbridge', '牛剑申请'],
  'BPhO|AMC|数学竞赛|物理竞赛|化学竞赛|竞赛|Olympiad': ['Competitions', '竞赛'],
  '文书|PS|Personal Statement|essay': ['EssayWorkshop', '文书写作'],
  '选校|排名|录取|College List': ['CollegeApps', '选校'],
  'STEM|科研|夏校|Research': ['STEMResearch', '科研'],
  '签证|Visa|F-1|I-20': ['Visa', '签证'],
  '实习|Internship|工作|Career': ['Career', '职业发展'],
  'GPA|GPA管理|成绩': ['GPA', '学术成绩'],
  '奖学金|Scholarship|助学金': ['Scholarship', '奖学金'],
  '转学|Transfer': ['Transfer', '转学'],
  '研究生|Master|PhD|博士': ['GradSchool', '研究生'],
}

// ── DB-aware keyword-to-tag mapping ────────────────────────

let _cachedRules: Record<string, string[]> | undefined = undefined

async function getTagRules(): Promise<Record<string, string[]>> {
  if (_cachedRules) return _cachedRules
  try {
    const config = await db.pipelineConfig.findFirst({
      where: { key: 'tag_classification_rules' },
    })
    if (config && (config as any).value) {
      const parsed = JSON.parse((config as any).value) as Record<string, string[]>
      if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        _cachedRules = parsed
        return parsed
      }
    }
  } catch {
    // Table may not exist or config not set
  }
  _cachedRules = DEFAULT_TAG_RULES
  return _cachedRules
}

// ── Classification ─────────────────────────────────────────

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

/**
 * Classify a post into tags using keyword matching.
 * Stage 1: deterministic keyword mapping
 * Stage 2: LLM fallback (only if keyword match < 2 tags)
 */
export async function classifyPostTags(
  title: string,
  content: unknown
): Promise<string[]> {
  const text = `${title} ${extractTextFromContent(content)}`
  const rules = await getTagRules()

  const matchedTags = new Set<string>()

  for (const [pattern, tagNames] of Object.entries(rules)) {
    if (new RegExp(pattern, 'i').test(text)) {
      for (const tag of tagNames) {
        matchedTags.add(tag)
      }
    }
  }

  const result = Array.from(matchedTags)

  // Stage 2: LLM fallback for sparse matches
  if (result.length < 2 && text.length > 50) {
    try {
      const llmTags = await classifyWithLLM(title, text)
      for (const tag of llmTags) {
        if (!matchedTags.has(tag)) {
          result.push(tag)
        }
      }
    } catch {
      // LLM classification is best-effort
    }
  }

  return result.slice(0, 8) // Cap at 8 tags
}

async function classifyWithLLM(title: string, text: string): Promise<string[]> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (!deepseekKey) return []

  const prompt = `Given the following academic article about study-abroad / international education, suggest 2-4 relevant tags (as a JSON array of strings). Tags should be concise, matching the content theme.

Title: ${title}
Content (excerpt): ${text.substring(0, 1500)}

Return ONLY a JSON array like: ["tag1", "tag2"]`

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3,
    }),
  })

  if (!res.ok) return []
  const json = await res.json()
  const reply = json.choices?.[0]?.message?.content || ''
  // Extract JSON array from reply
  const match = reply.match(/\[.*\]/s)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed.map((t: any) => String(t).trim())
    } catch {
      // parse error
    }
  }
  return []
}

// ── Tag lifecycle ──────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Ensure a set of tag names exist in DB.
 * Creates any missing tags, returns the full tag records.
 */
export async function ensureTagsExist(tagNames: string[]): Promise<any[]> {
  if (!tagNames.length) return []

  const tags: any[] = []

  for (const name of tagNames) {
    const slug = slugify(name)
    try {
      const existing = await db.tag.findFirst({
        where: { slug },
      })
      if (existing) {
        tags.push(existing)
      } else {
        const created = await db.tag.create({
          data: { name, slug },
        })
        tags.push(created)
      }
    } catch {
      // Best-effort, skip on conflict
    }
  }

  return tags
}

/**
 * Create PostTag links, updating Tag.postCount.
 */
export async function linkPostTags(postId: string, tagIds: string[]): Promise<void> {
  for (const tagId of tagIds) {
    try {
      await db.postTag.create({ data: { postId, tagId } })
      // Increment postCount
      const tag = await db.tag.findFirst({ where: { id: tagId } })
      if (tag) {
        await db.tag.update({
          where: { id: tagId },
          data: { postCount: ((tag as any).postCount || 0) + 1 },
        })
      }
    } catch {
      // Duplicate PostTag or other error — skip
    }
  }
}

/**
 * Full pipeline: classify → ensure tags exist → link to post
 */
export async function autoTagPost(
  postId: string,
  title: string,
  content: unknown
): Promise<string[]> {
  try {
    const tagNames = await classifyPostTags(title, content)
    if (!tagNames.length) return []

    const tags = await ensureTagsExist(tagNames)
    const tagIds = tags.map((t: any) => t.id)

    await linkPostTags(postId, tagIds)
    return tagNames
  } catch {
    // Tag classification is best-effort, never crash the publishing pipeline
    return []
  }
}
