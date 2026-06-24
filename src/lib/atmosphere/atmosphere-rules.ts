import { db } from '@/lib/db'
import type {
  AtmosphereConfig,
  AtmosphereSlot,
  AtmosphereAction,
  AiCommentContext,
} from './types'
import { DEFAULT_ATMOSPHERE_CONFIG } from './types'

/**
 * Load atmosphere configuration from PipelineConfig table.
 * Falls back to DEFAULT_ATMOSPHERE_CONFIG if not found or on error.
 */
export async function loadAtmosphereConfig(): Promise<AtmosphereConfig> {
  try {
    const row = (await db.pipelineConfig.findFirst({
      where: { key: 'atmosphere_rules' },
    })) as { value: unknown } | null
    if (row?.value) {
      const raw = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
      return {
        ...DEFAULT_ATMOSPHERE_CONFIG,
        ...(raw as Partial<AtmosphereConfig>),
      }
    }
  } catch (e) {
    console.warn('[atmosphere-rules] Failed to load config, using defaults:', e)
  }
  return DEFAULT_ATMOSPHERE_CONFIG
}

/**
 * Calculate which AI roles should comment/reply on a post right now,
 * based on the post publish time, existing AI comments, and time slot rules.
 */
export function getDueActions(
  post: {
    id: string
    title: string
    content: string
    createdAt: string | Date
  },
  existingAiComments: AiCommentContext[],
  config: AtmosphereConfig,
  now: Date = new Date()
): AtmosphereAction[] {
  const postTime = new Date(post.createdAt).getTime()
  const hoursSincePost = (now.getTime() - postTime) / (1000 * 60 * 60)
  const aiCount = existingAiComments.length

  if (aiCount >= config.maxAiCommentsPerPost) return []

  const actions: AtmosphereAction[] = []

  for (const slot of config.slots) {
    if (actions.length >= 3) break // max 3 actions per post per run

    // Check time window
    if (hoursSincePost < slot.minHours || hoursSincePost >= slot.maxHours) continue

    // Check minimum AI comment count requirement
    if (slot.requiresExistingCount && aiCount < slot.requiresExistingCount) continue

    // Check if this role+slot combination already fired
    const alreadyFired = existingAiComments.some((c) => {
      // Match by role and approximate time window
      const commentTime = new Date(c.createdAt).getTime()
      const commentHoursSincePost = (commentTime - postTime) / (1000 * 60 * 60)
      return (
        c.authorRole === slot.role &&
        commentHoursSincePost >= slot.minHours - 1 &&
        commentHoursSincePost <= slot.maxHours + 1
      )
    })
    if (alreadyFired) continue

    const action: AtmosphereAction = {
      postId: post.id,
      postTitle: post.title,
      postContent: post.content,
      role: slot.role,
      style: slot.style,
      existingAiComments,
    }

    // For reply-style slots, find the target comment to reply to
    if (slot.style === 'reply' && slot.replyTo) {
      const targetComment = existingAiComments.find(
        (c) => c.authorRole === slot.replyTo
      )
      if (targetComment && Math.random() < config.replyProbability) {
        action.replyToCommentId = targetComment.id
        action.replyToCommentText = targetComment.text
        action.replyToAuthorRole = targetComment.authorRole
      } else {
        // No suitable reply target — skip this slot or fall back to top-level comment
        if (!targetComment) continue
        // Has target but probability check failed
        continue
      }
    }

    actions.push(action)
  }

  return actions
}
