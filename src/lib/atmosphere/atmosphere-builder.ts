import { db } from '@/lib/db'
import { loadAtmosphereConfig, getDueActions } from './atmosphere-rules'
import { generateComment } from './comment-generator'
import {
  createPipelineExecution,
  markPipelineSuccess,
  markPipelineFailed,
} from '@/lib/pipeline-logger'
import { checkContentQuality, getSensitiveWordFilter } from '@/lib/moderation'
import type {
  AtmosphereConfig,
  AtmosphereAction,
  AtmosphereResult,
  AtmosphereReport,
  AiCommentContext,
} from './types'

type AiUserInfo = { id: string; aiRole: string }

/**
 * Find AI users and build lookup maps (role→user and id→role).
 */
async function getAiUserMap(): Promise<{
  byRole: Map<string, AiUserInfo>
  idToRole: Map<string, string>
}> {
  const users = (await db.user.findMany({
    where: { isAI: true },
    select: { id: true, aiRole: true },
  })) as { id: string; aiRole: string }[]

  const byRole = new Map<string, AiUserInfo>()
  const idToRole = new Map<string, string>()
  for (const u of users) {
    if (u.aiRole) {
      byRole.set(u.aiRole, u)
      idToRole.set(u.id, u.aiRole)
    }
  }
  return { byRole, idToRole }
}

/**
 * Query eligible posts: published within lookbackDays.
 */
async function getEligiblePosts(config: AtmosphereConfig): Promise<
  Array<{ id: string; title: string; content: string; createdAt: string; authorId: string; voteCount: number }>
> {
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - config.lookbackDays)

  const posts = (await db.post.findMany({
    where: { createdAt: { gte: lookbackDate.toISOString() }, status: 'PUBLISHED' },
    select: { id: true, title: true, content: true, createdAt: true, authorId: true, voteCount: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })) as { id: string; title: string; content: string; createdAt: string; authorId: string; voteCount: number }[]

  return posts
}

/**
 * Load existing AI-authored comments for a post, annotated with author roles.
 */
async function getAiCommentsForPost(
  postId: string,
  aiUserIds: string[],
  idToRole: Map<string, string>
): Promise<AiCommentContext[]> {
  if (aiUserIds.length === 0) return []

  const allComments: AiCommentContext[] = []
  for (const uid of aiUserIds) {
    const batch = (await db.comment.findMany({
      where: { postId, authorId: uid },
      select: { id: true, text: true, authorId: true, createdAt: true, replyToId: true },
      take: 20,
    })) as any[]
    for (const c of batch) {
      allComments.push({
        id: c.id,
        text: c.text,
        authorRole: idToRole.get(c.authorId) || '',
        createdAt: c.createdAt,
        isReplyToId: c.replyToId,
      })
    }
  }
  return allComments
}

/**
 * Extract plain text from EditorJS JSON content for quality evaluation.
 */
function extractContentText(content: unknown): string {
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    if (parsed && typeof parsed === 'object') {
      const blocks = (parsed as any).blocks as any[] | undefined
      if (blocks) {
        return blocks
          .map((b: any) => b.data?.text || '')
          .join('\n')
          .trim()
      }
      if (typeof (parsed as any).text === 'string') return (parsed as any).text.trim()
    }
    return String(content).slice(0, 3000)
  } catch {
    return String(content).slice(0, 3000)
  }
}

/**
 * Multi-phase quality check for a post.
 * Returns { passed, reason, score }.
 */
async function evaluatePostQuality(
  post: { id: string; title: string; content: string; authorId: string; voteCount: number },
  config: AtmosphereConfig,
  aiUserIdSet: Set<string>
): Promise<{ passed: boolean; reason: string; score: number }> {
  const qf = config.qualityFilter
  if (!qf?.enabled) return { passed: true, reason: 'filter disabled', score: 0 }

  // Phase 1: Skip AI-authored posts
  if (qf.skipAiAuthoredPosts && aiUserIdSet.has(post.authorId)) {
    return { passed: false, reason: 'AI-authored post', score: 0 }
  }

  // Phase 2: Empty or placeholder title
  if (qf.requireNonEmptyTitle) {
    const t = post.title.trim()
    if (!t || t === '无标题' || t.length < 2) {
      return { passed: false, reason: 'empty/placeholder title', score: 100 }
    }
  }

  // Phase 3: Content too short
  const contentText = extractContentText(post.content)
  if (contentText.length < qf.minContentLength) {
    return { passed: false, reason: `content too short (${contentText.length} chars)`, score: 100 }
  }

  // Phase 4: Trie-based sensitive word check (fast, no API call)
  const trie = getSensitiveWordFilter()
  const hits = trie.search(contentText)
  if (hits.length >= qf.maxSensitiveWordHits) {
    return { passed: false, reason: `sensitive words: ${hits.join(', ')}`, score: 100 }
  }

  // Phase 5: DeepSeek deep quality check
  if (qf.deepseekQualityCheck && process.env.DEEPSEEK_API_KEY) {
    const result = await checkContentQuality(contentText, `标题: ${post.title}`)
    if (!result.passed || result.score >= qf.minDeepseekScore) {
      return { passed: false, reason: `DeepSeek score=${result.score}`, score: result.score }
    }
  }

  return { passed: true, reason: 'ok', score: 0 }
}

/**
 * Main atmosphere builder — scans posts and orchestrates AI comments.
 */
export async function buildAtmosphere(
  maxNewComments?: number
): Promise<AtmosphereReport> {
  const executionId = await createPipelineExecution(
    'atmosphere_builder',
    'Scheduled atmosphere run',
    undefined,
    1
  )

  const report: AtmosphereReport = {
    postsScanned: 0,
    postsMatched: 0,
    commentsCreated: 0,
    postsFilteredByQuality: 0,
    details: [],
  }

  try {
    const config = await loadAtmosphereConfig()
    if (!config.enabled) {
      await markPipelineSuccess(executionId, 'Disabled by config')
      return report
    }

    const maxPerRun = maxNewComments ?? config.globalMaxPerRun
    const { byRole, idToRole } = await getAiUserMap()
    const aiUserIds = Array.from(byRole.values()).map((u) => u.id)

    const posts = await getEligiblePosts(config)
    report.postsScanned = posts.length
    const aiUserIdSet = new Set(aiUserIds)

    for (const post of posts) {
      if (report.commentsCreated >= maxPerRun) break

      // Quality gate: skip low-quality / spam posts
      const qualityResult = await evaluatePostQuality(post, config, aiUserIdSet)
      if (!qualityResult.passed) {
        report.postsFilteredByQuality++
        report.details.push({
          postId: post.id,
          role: '',
          action: 'skipped',
          reason: `Quality filter: ${qualityResult.reason}`,
        })
        continue
      }

      const existingAiComments = await getAiCommentsForPost(post.id, aiUserIds, idToRole)

      const actions = getDueActions(post, existingAiComments, config)
      if (actions.length === 0) continue
      report.postsMatched++

      for (const action of actions) {
        if (report.commentsCreated >= maxPerRun) break

        const aiUser = byRole.get(action.role)
        if (!aiUser) {
          report.details.push({
            postId: action.postId,
            role: action.role,
            action: 'skipped',
            reason: `AI user ${action.role} not found`,
          })
          continue
        }

        const commentText = await generateComment(action)
        if (!commentText) {
          report.details.push({
            postId: action.postId,
            role: action.role,
            action: 'skipped',
            reason: 'Generated text empty',
          })
          continue
        }

        try {
          const data: Record<string, unknown> = {
            text: commentText,
            authorId: aiUser.id,
            postId: action.postId,
          }
          if (action.style === 'reply' && action.replyToCommentId) {
            data.replyToId = action.replyToCommentId
          }

          const created = (await db.comment.create({ data })) as { id: string }

          report.commentsCreated++
          report.details.push({
            postId: action.postId,
            role: action.role,
            action: action.style,
            commentId: created.id,
            commentText: commentText.slice(0, 200),
          })
        } catch (e) {
          console.warn(`[atmosphere] Failed to create comment for ${action.postId}:`, e)
          report.details.push({
            postId: action.postId,
            role: action.role,
            action: 'skipped',
            reason: e instanceof Error ? e.message : 'DB create failed',
          })
        }
      }
    }

    await markPipelineSuccess(
      executionId,
      `${report.commentsCreated} comments on ${report.postsMatched} posts (${report.postsFilteredByQuality} filtered out)`
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[atmosphere] Build failed:', msg)
    await markPipelineFailed(executionId, msg)
  }

  return report
}
