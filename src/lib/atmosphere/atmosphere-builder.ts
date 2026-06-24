import { db } from '@/lib/db'
import { loadAtmosphereConfig, getDueActions } from './atmosphere-rules'
import { generateComment } from './comment-generator'
import {
  createPipelineExecution,
  markPipelineSuccess,
  markPipelineFailed,
} from '@/lib/pipeline-logger'
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
  Array<{ id: string; title: string; content: string; createdAt: string }>
> {
  const lookbackDate = new Date()
  lookbackDate.setDate(lookbackDate.getDate() - config.lookbackDays)
  const lookbackTime = lookbackDate.getTime()

  const posts = (await db.post.findMany({
    select: { id: true, title: true, content: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })) as { id: string; title: string; content: string; createdAt: string }[]

  // Filter in JS — Supabase REST adapter's .eq() doesn't support gte/lte range queries
  return posts.filter((p) => new Date(p.createdAt).getTime() >= lookbackTime)
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

    for (const post of posts) {
      if (report.commentsCreated >= maxPerRun) break

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
      `${report.commentsCreated} comments on ${report.postsMatched} posts`
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[atmosphere] Build failed:', msg)
    await markPipelineFailed(executionId, msg)
  }

  return report
}
