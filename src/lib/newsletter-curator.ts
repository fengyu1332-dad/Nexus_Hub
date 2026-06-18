import { db } from '@/lib/db'
import { createPipelineExecution, markPipelineSuccess, markPipelineFailed } from '@/lib/pipeline-logger'

interface CuratedPost {
  title: string
  summary: string
  subreddit: string
  author: string
  postId: string
  tags: string[]
}

interface CuratedDigest {
  weekStart: string
  totalPosts: number
  sections: {
    title: string
    posts: CuratedPost[]
  }[]
}

function extractText(content: unknown): string {
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
 * Curate this week's AI posts into a structured digest grouped by tag.
 * Fallback: if no tags configured, groups all posts under "本周精选".
 */
export async function curateWeeklyDigest(): Promise<CuratedDigest> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  // 1. Get AI user IDs
  const aiUsers = (await db.user.findMany({
    where: { isAI: true },
    select: { id: true, username: true, aiRole: true },
  }).catch(() => [])) as { id: string; username: string; aiRole: string | null }[]

  const aiUserIds = aiUsers.map((u) => u.id)
  const authorMap = new Map(aiUsers.map((u) => [u.id, u]))

  if (aiUserIds.length === 0) {
    return { weekStart: weekStart.toISOString(), totalPosts: 0, sections: [] }
  }

  // 2. Get this week's AI posts
  const posts = (await db.post.findMany({
    where: {
      createdAt: { gte: weekStart.toISOString() },
      authorId: { in: aiUserIds },
    },
    orderBy: { voteCount: 'desc' },
    take: 50,
    select: { id: true, title: true, content: true, createdAt: true, subredditId: true, authorId: true, voteCount: true },
  }).catch(() => [])) as any[]

  // 3. Resolve subreddit names
  const subIds = Array.from(new Set(posts.map((p: any) => p.subredditId)))
  const subMap = new Map<string, string>()
  for (const sid of subIds) {
    const s = await db.subreddit.findFirst({ where: { id: sid }, select: { name: true } }).catch(() => null)
    subMap.set(sid, (s as any)?.name || 'Nexus')
  }

  // 4. Get tags for all posts
  const postIds = posts.map((p: any) => p.id)
  const tagMap = new Map<string, string[]>()
  if (postIds.length > 0) {
    const postTags = await db.postTag.findMany({
      where: { postId: { in: postIds } },
      select: { postId: true, tagId: true },
    }).catch(() => []) as { postId: string; tagId: string }[]

    // Get tag names
    const tagIds = Array.from(new Set(postTags.map((pt) => pt.tagId)))
    const tagNameMap = new Map<string, string>()
    for (const tid of tagIds) {
      const tag = await db.tag.findFirst({ where: { id: tid }, select: { name: true } }).catch(() => null)
      tagNameMap.set(tid, (tag as any)?.name || 'Unknown')
    }

    for (const pt of postTags) {
      const tags = tagMap.get(pt.postId) || []
      const tagName = tagNameMap.get(pt.tagId) || 'Unknown'
      if (!tags.includes(tagName)) tags.push(tagName)
      tagMap.set(pt.postId, tags)
    }
  }

  // 5. Build curated posts
  const curated: CuratedPost[] = posts.map((p: any) => {
    const author = authorMap.get(p.authorId)
    return {
      title: p.title,
      summary: extractText(p.content).substring(0, 200) || p.title,
      subreddit: subMap.get(p.subredditId) || 'Nexus',
      author: author?.aiRole || author?.username || 'AI',
      postId: p.id,
      tags: tagMap.get(p.id) || [],
    }
  })

  // 6. Group by tag (take top 2 per tag by vote order)
  const sections: Map<string, CuratedPost[]> = new Map()
  const seenIds = new Set<string>()

  for (const post of curated) {
    const primaryTag = post.tags[0] || '本周精选'
    if (seenIds.has(post.postId)) continue

    const section = sections.get(primaryTag) || []
    if (section.length < 2) {
      section.push(post)
      seenIds.add(post.postId)
    }
    sections.set(primaryTag, section)
  }

  // If no tags, single section
  if (sections.size === 0) {
    sections.set('本周精选', curated.slice(0, 8))
  }

  return {
    weekStart: weekStart.toISOString(),
    totalPosts: curated.length,
    sections: Array.from(sections.entries()).map(([title, posts]) => ({ title, posts })),
  }
}

/**
 * Render curated digest to HTML for email sending.
 */
export function renderDigestHtml(digest: CuratedDigest, baseUrl: string): string {
  const sectionsHtml = digest.sections
    .map(
      (section) => `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #e11d48; font-size: 18px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #fecdd3;">
        ${escapeHtml(section.title)}
      </h2>
      ${section.posts
        .map(
          (p) => `
      <div style="margin-bottom: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h3 style="margin: 0 0 6px 0;">
          <a href="${baseUrl}/r/${p.subreddit}/post/${p.postId}"
             style="color: #1f2937; text-decoration: none; font-size: 15px;">
            ${escapeHtml(p.title)}
          </a>
        </h3>
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 6px 0;">${escapeHtml(p.summary)}</p>
        <span style="color: #9ca3af; font-size: 11px;">${escapeHtml(p.subreddit)} · ${escapeHtml(p.author)}</span>
        ${p.tags.length > 0 ? `<span style="color: #d1d5db; font-size: 11px;"> · ${p.tags.map((t) => escapeHtml(t)).join(', ')}</span>` : ''}
      </div>`
        )
        .join('')}
    </div>`
    )
    .join('')

  const weekLabel = new Date(digest.weekStart).toLocaleDateString('zh-CN')

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h1 style="color: #e11d48; margin: 0;">Nexus Hub</h1>
    <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0 0;">AI 驱动学术周报 · ${weekLabel} 起</p>
  </div>
  <p style="color: #4b5563; font-size: 14px; margin-bottom: 20px;">
    以下是本周 The Architect 为你精选的学术内容（共 ${digest.totalPosts} 篇）：
  </p>
  ${sectionsHtml}
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 11px; text-align: center;">
    由 <a href="${baseUrl}" style="color: #e11d48;">Nexus Hub</a> The Architect 自动汇编 · <a href="%UNSUBSCRIBE_URL%" style="color: #9ca3af;">一键退订</a>
  </p>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Send curated newsletter to active subscribers.
 * Records to PipelineExecution for tracking.
 */
export async function sendCuratedNewsletter(executionId?: string): Promise<{
  sent: number; failed: number; totalSubscribers: number; postsIncluded: number
}> {
  const execId = executionId || await createPipelineExecution('newsletter_send', 'Weekly newsletter send', undefined, 1)

  try {
    const digest = await curateWeeklyDigest()
    if (digest.totalPosts === 0) {
      await markPipelineSuccess(execId, 'No AI posts this week')
      return { sent: 0, failed: 0, totalSubscribers: 0, postsIncluded: 0 }
    }

    const subs = await db.newsletterSubscriber.findMany({
      where: { active: true },
      select: { email: true, unsubscribeToken: true },
    }).catch(() => []) as { email: string; unsubscribeToken?: string }[]

    if (!subs.length) {
      await markPipelineSuccess(execId, 'No active subscribers')
      return { sent: 0, failed: 0, totalSubscribers: 0, postsIncluded: digest.totalPosts }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { Resend } = await import('resend')
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      await markPipelineFailed(execId, 'RESEND_API_KEY not configured')
      return { sent: 0, failed: subs.length, totalSubscribers: subs.length, postsIncluded: digest.totalPosts }
    }

    const resend = new Resend(apiKey)
    const FROM = process.env.NEWSLETTER_FROM || 'Nexus Hub <newsletter@nexus-hub.vercel.app>'
    let sent = 0
    let failed = 0

    for (const sub of subs) {
      try {
        const html = renderDigestHtml(digest, baseUrl).replace(
          '%UNSUBSCRIBE_URL%',
          `${baseUrl}/api/newsletter/subscribe?action=unsubscribe&token=${encodeURIComponent(sub.unsubscribeToken || '')}`
        )
        await resend.emails.send({
          from: FROM,
          to: sub.email,
          subject: `Nexus Hub 学术周报 — ${new Date().toLocaleDateString('zh-CN')}`,
          html,
        })
        sent++
      } catch (e) {
        console.error(`[newsletter] Failed to send to ${sub.email}:`, e)
        failed++
      }
    }

    await markPipelineSuccess(execId, `Sent ${sent}, failed ${failed}, ${digest.totalPosts} posts`)
    return { sent, failed, totalSubscribers: subs.length, postsIncluded: digest.totalPosts }
  } catch (err: any) {
    await markPipelineFailed(execId, err.message || 'Unknown error')
    throw err
  }
}
