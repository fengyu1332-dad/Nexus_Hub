/**
 * Atmosphere Builder — 编排器
 *
 * 主流程：加载配置 → 查询帖子 → 判断动作 → 生成评论 → 创建记录
 */
import { db } from '@/lib/db'
import {
  createPipelineExecution,
  markPipelineSuccess,
  markPipelineFailed,
} from '@/lib/pipeline-logger'
import { loadAtmosphereConfig, getDueActions, getPostFilters } from './atmosphere-rules'
import { generateComment } from './comment-generator'
import { extractPostSummary } from '@/lib/flora-auto'
import { validateContent } from '@/lib/encoding'
import type {
  AtmosphereConfig,
  AtmosphereAction,
  AtmosphereResult,
  ExistingAiComment,
} from './types'

export interface BuildAtmosphereInput {
  maxNewComments?: number
  forceRun?: boolean
}

export interface BuildAtmosphereOutput {
  postsScanned: number
  postsProcessed: number
  commentsCreated: number
  details: AtmosphereResult[]
}

export async function buildAtmosphere(
  input: BuildAtmosphereInput = {}
): Promise<BuildAtmosphereOutput> {
  const executionId = await createPipelineExecution(
    'atmosphere_builder',
    `Scheduled run: maxNewComments=${input.maxNewComments ?? 'default'}`,
    undefined,
    2
  )

  const details: AtmosphereResult[] = []
  let postsScanned = 0
  let postsProcessed = 0
  let commentsCreated = 0

  try {
    const config = await loadAtmosphereConfig()
    if (!config.enabled) {
      await markPipelineSuccess(executionId, 'Disabled')
      return { postsScanned: 0, postsProcessed: 0, commentsCreated: 0, details: [] }
    }

    const maxNewComments = Math.min(
      input.maxNewComments || config.globalMaxPerRun,
      config.globalMaxPerRun
    )
    const now = new Date()
    const { lookbackDate, maxAgeDate } = getPostFilters(config, now)

    const posts = await fetchEligiblePosts(config, lookbackDate, maxAgeDate)
    const uniquePosts = posts.filter(
      (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
    )
    postsScanned = uniquePosts.length

    for (const post of uniquePosts) {
      if (commentsCreated >= maxNewComments) break
      const result = await processPost(post, config, now, maxNewComments - commentsCreated)
      details.push(...result.details)
      commentsCreated += result.commentsCreated
      postsProcessed += result.postsProcessed
    }

    await markPipelineSuccess(
      executionId,
      `Scanned=${postsScanned} Processed=${postsProcessed} Created=${commentsCreated}`
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : (typeof error === 'object' ? JSON.stringify(error) : String(error))
    console.error('[atmosphere-builder] Error:', msg)
    if (error instanceof Error && error.stack) {
      console.error('[atmosphere-builder] Stack:', error.stack.split('\n').slice(0, 3).join('\n'))
    }
    await markPipelineFailed(executionId, msg)
  }

  return { postsScanned, postsProcessed, commentsCreated, details }
}

/** 处理单个帖子 */
async function processPost(
  post: any,
  config: AtmosphereConfig,
  now: Date,
  remainingQuota: number
): Promise<{ details: AtmosphereResult[]; commentsCreated: number; postsProcessed: number }> {
  const details: AtmosphereResult[] = []
  let commentsCreated = 0

  try {
    const existingAiComments = await loadAiComments(post.id)
    const postCreatedAt = new Date(post.createdAt)
    const actions = getDueActions(postCreatedAt, existingAiComments, config, now)
    if (actions.length === 0) return { details, commentsCreated: 0, postsProcessed: 0 }

    const postSummary = typeof post.content === 'string'
      ? post.content
      : extractPostSummary(post.content)

    const postContext = {
      title: post.title || '',
      content: postSummary,
      subredditName: post.subreddit?.name || 'Nexus',
      authorRole: post.author?.aiRole || 'Newton',
    }

    const aiUsers = await loadAiUsers()
    if (!aiUsers) return { details, commentsCreated: 0, postsProcessed: 0 }

    let postsProcessed = 0
    for (const action of actions) {
      if (commentsCreated >= remainingQuota) break

      const result = await executeAction(
        action, postContext, existingAiComments, aiUsers, config, post.id
      )

      details.push(result)
      if (result.executed) {
        commentsCreated++
        postsProcessed = 1
        existingAiComments.push({
          id: result.commentId || '',
          text: '(just created)',
          authorId: aiUsers[action.role],
          authorRole: action.role,
          authorUsername: `AI-${action.role}`,
          createdAt: new Date(),
          replyToId: action.replyToCommentId || null,
        })
      }
    }

    return { details, commentsCreated, postsProcessed }
  } catch (postError) {
    const postMsg = postError instanceof Error ? postError.message : String(postError)
    console.warn('[atmosphere-builder] Post error:', postMsg)
    details.push({
      postId: post.id,
      role: 'Flora',
      style: 'welcome',
      executed: false,
      reasonSkipped: postMsg,
    })
    return { details, commentsCreated: 0, postsProcessed: 0 }
  }
}

/** 查询符合条件的帖子 */
async function fetchEligiblePosts(
  config: AtmosphereConfig,
  lookbackDate: Date,
  maxAgeDate: Date
) {
  const baseWhere: any = {
    createdAt: {
      gte: lookbackDate.toISOString(),
      lte: maxAgeDate.toISOString(),
    },
    status: 'PUBLISHED',
  }

  if (config.aiPostsOnly) {
    const aiAuthorIds = (
      await db.user.findMany({
        where: { isAI: true },
        select: { id: true, aiRole: true },
      })
    ).map((u: any) => u.id)

    if (aiAuthorIds.length === 0) return []

    const posts = (await db.post.findMany({
      where: {
        ...baseWhere,
        authorId: { in: aiAuthorIds },
      },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        authorId: true,
        subredditId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })) as any[]

    return await enrichPosts(posts)
  }

  const posts = (await db.post.findMany({
    where: baseWhere,
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      authorId: true,
      subredditId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })) as any[]

  return await enrichPosts(posts)
}

/** 批量为帖子附加 author 和 subreddit 信息 */
async function enrichPosts(posts: any[]) {
  if (posts.length === 0) return []

  const authorIds = Array.from(new Set(posts.map((p: any) => p.authorId))) as string[]
  const subredditIds = Array.from(new Set(posts.map((p: any) => p.subredditId))) as string[]

  const [authors, subreddits] = await Promise.all([
    db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, aiRole: true, isAI: true },
    }),
    db.subreddit.findMany({
      where: { id: { in: subredditIds } },
      select: { id: true, name: true },
    }),
  ])

  const authorMap = new Map((authors as any[]).map((a: any) => [a.id, a]))
  const subredditMap = new Map((subreddits as any[]).map((s: any) => [s.id, s]))

  return posts.map((p: any) => ({
    ...p,
    author: authorMap.get(p.authorId) || { aiRole: null, isAI: false },
    subreddit: subredditMap.get(p.subredditId) || { name: 'Nexus' },
  }))
}

/** 加载帖子的现有 AI 评论 */
async function loadAiComments(postId: string): Promise<ExistingAiComment[]> {
  const aiUsers = await db.user.findMany({
    where: { isAI: true },
    select: { id: true, aiRole: true, username: true },
  }) as { id: string; aiRole: string | null; username: string }[]

  const aiUserIds = aiUsers.map((u) => u.id)

  const comments = await db.comment.findMany({
    where: {
      postId,
      authorId: { in: aiUserIds },
    },
    select: {
      id: true,
      text: true,
      authorId: true,
      replyToId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return comments.map((c: any) => {
    const author = aiUsers.find((u) => u.id === c.authorId)
    return {
      id: c.id,
      text: c.text,
      authorId: c.authorId,
      authorRole: author?.aiRole || 'unknown',
      authorUsername: author?.username || 'unknown',
      createdAt: c.createdAt,
      replyToId: c.replyToId,
    }
  })
}

/** 加载 AI 用户映射 */
async function loadAiUsers(): Promise<Record<string, string> | null> {
  const users = await db.user.findMany({
    where: { isAI: true },
    select: { id: true, aiRole: true },
  }) as { id: string; aiRole: string | null }[]

  const map: Record<string, string> = {}
  for (const u of users) {
    if (u.aiRole) map[u.aiRole] = u.id
  }
  return Object.keys(map).length > 0 ? map : null
}

/** 执行单个动作 */
async function executeAction(
  action: AtmosphereAction,
  postContext: { title: string; content: string; subredditName: string; authorRole: string },
  existingAiComments: ExistingAiComment[],
  aiUsers: Record<string, string>,
  config: AtmosphereConfig,
  postId: string
): Promise<AtmosphereResult> {
  const authorId = aiUsers[action.role]
  if (!authorId) {
    return {
      postId, role: action.role, style: action.style,
      executed: false, reasonSkipped: `AI user '${action.role}' not found`,
    }
  }

  if (action.type === 'reply' && Math.random() > config.replyProbability) {
    return {
      postId, role: action.role, style: action.style,
      executed: false, reasonSkipped: 'Random skip (replyProbability)',
    }
  }

  const commentContexts = existingAiComments.map((c) => ({
    role: c.authorRole || 'unknown',
    text: c.text,
    authorRole: c.authorRole || 'unknown',
  }))

  let replyToText: string | undefined
  let replyToRole: string | undefined
  if (action.replyToCommentId) {
    const target = existingAiComments.find((c) => c.id === action.replyToCommentId)
    if (target) {
      replyToText = target.text
      replyToRole = target.authorRole
    }
  }

  try {
    const commentText = await generateComment(
      action.role, postContext, commentContexts,
      action.style, replyToText, replyToRole
    )

    if (!commentText.trim()) {
      return {
        postId, role: action.role, style: action.style,
        executed: false, reasonSkipped: 'No comment generated',
      }
    }

    // Encoding validation and repair
    const validated = validateContent(commentText, `${action.role}-comment`)
    if (!validated.valid) {
      return {
        postId, role: action.role, style: action.style,
        executed: false, reasonSkipped: 'Comment encoding invalid',
      }
    }

    const comment = await db.comment.create({
      data: {
        text: validated.text,
        authorId,
        postId,
        replyToId: action.replyToCommentId || undefined,
      },
      select: { id: true },
    })

    console.log(`[atmosphere-builder] ${action.role} ${action.type} created: ${(comment as any).id}`)
    return {
      postId, role: action.role, style: action.style,
      executed: true, commentId: (comment as any).id,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[atmosphere-builder] Failed to create ${action.role} comment:`, msg)
    return {
      postId, role: action.role, style: action.style,
      executed: false, reasonSkipped: msg,
    }
  }
}
