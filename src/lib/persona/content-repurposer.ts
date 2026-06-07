/**
 * =============================================================================
 * Nexus Hub — 多模态内容复用器 (Content Repurposer)
 * =============================================================================
 *
 * 将 Newton 的主文章自动拆解为适配不同平台的精简内容：
 *   1. 小红书图文卡片
 *   2. 抖音/短视频口播脚本
 *   3. 微信朋友圈/Telegram 频道要点速览
 *
 * 使用方式:
 *   - 在 n8n Newton 节点之后新增一个 Code Node
 *   - 将主文章传入 buildRepurposePrompt() 生成的 Prompt
 *   - 再调用一次 DeepSeek，获取多模态输出
 */

// ── 平台配置 ──────────────────────────────────────────────

interface PlatformConfig {
  name: string
  icon: string
  maxChars: number
  style: string
  format: string
}

export const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    maxChars: 1000,
    style: '活泼、emoji 密集、每句话换行、带话题标签、口语化',
    format: `输出格式:
【标题】吸引眼球的爆款标题（15字以内，带 emoji）
【正文】3-5 个核心要点，每点 2-3 句话，大量换行
【互动引导】1 句引导评论的话
【标签】5-8 个相关话题标签`,
  },
  douyin: {
    name: '抖音短视频',
    icon: '🎵',
    maxChars: 500,
    style: '口语化、快节奏、有画面感、适合口播、每句是一个画面切换点',
    format: `输出格式:
【黄金3秒开头】一个令人好奇或震撼的开场（1-2句）
【核心内容】3 个要点，每个标注[画面切换]
【结尾CTA】引导点赞/收藏/评论的一句话
【建议BGM】推荐背景音乐风格`,
  },
  tldr: {
    name: '要点速览',
    icon: '⚡',
    maxChars: 500,
    style: '极简、一图胜千言、适合截图转发',
    format: `输出格式:
【一句话总结】用 20 字概括全文
【3 个关键数字】最核心的 3 个数据
【1 个行动建议】读者最该做的一件事`,
  },
}

// ── 复用 Prompt 构建 ──────────────────────────────────────

export function buildRepurposePrompt(
  articleTitle: string,
  articleContent: string,
  platforms: string[] = ['xiaohongshu', 'douyin', 'tldr']
): string {
  const platformSections = platforms
    .map((key) => {
      const cfg = PLATFORM_CONFIGS[key]
      if (!cfg) return ''
      return `### ${cfg.icon} ${cfg.name}
风格: ${cfg.style}
${cfg.format}`
    })
    .filter(Boolean)
    .join('\n\n')

  return `你是一个专业的**内容运营专家**。请将以下长文拆解为适配不同平台的精简版本。

## 原文标题
${articleTitle}

## 原文内容
${articleContent.substring(0, 3000)}

## 输出要求
${platformSections}

## 通用原则
- 保留原文的核心数据和关键观点，不要编造
- 适配各平台的语气和格式，不要照搬原文
- 每条内容独立可用，不依赖原文上下文
- 用 Markdown 分隔各平台内容（用 --- 分割线）`
}

// ── 解析复用结果 ──────────────────────────────────────────

export interface RepurposedContent {
  xiaohongshu?: string
  douyin?: string
  tldr?: string
  raw: string
}

export function parseRepurposedOutput(raw: string): RepurposedContent {
  const result: RepurposedContent = { raw }

  // 按 --- 分割线拆分
  const sections = raw.split(/\n---\n/)

  for (const section of sections) {
    const lower = section.toLowerCase()
    if (lower.includes('小红书') || lower.includes('xiaohongshu') || section.includes('📕')) {
      result.xiaohongshu = section.trim()
    } else if (lower.includes('抖音') || lower.includes('douyin') || section.includes('🎵')) {
      result.douyin = section.trim()
    } else if (lower.includes('要点速览') || lower.includes('tldr') || section.includes('⚡')) {
      result.tldr = section.trim()
    }
  }

  return result
}

// ── 合并输出（注入到文章末尾） ─────────────────────────────

export function buildArticleWithMultimodal(
  article: string,
  repurposed: RepurposedContent
): string {
  const parts = [article]

  if (repurposed.tldr) {
    parts.push('\n\n---\n## ⚡ 要点速览\n' + repurposed.tldr)
  }
  if (repurposed.xiaohongshu) {
    parts.push('\n\n---\n## 📕 小红书图文版\n' + repurposed.xiaohongshu)
  }
  if (repurposed.douyin) {
    parts.push('\n\n---\n## 🎵 短视频脚本版\n' + repurposed.douyin)
  }

  return parts.join('\n')
}
