import { db } from '@/lib/db'
import { checkContentQuality, getSensitiveWordFilter } from '@/lib/moderation'
import {
  createPipelineExecution,
  markPipelineSuccess,
  markPipelineFailed,
} from '@/lib/pipeline-logger'
import type {
  ModeratorConfig,
  ModeratorAction,
  QualityTier,
  ModeratorPostResult,
  ModeratorReport,
} from './types'
import { DEFAULT_MODERATOR_CONFIG } from './types'

/**
 * Load moderator config from PipelineConfig table.
 * Falls back to DEFAULT_MODERATOR_CONFIG if no entry exists.
 */
async function loadModeratorConfig(): Promise<ModeratorConfig> {
  try {
    const rows = (await db.pipelineConfig.findMany({
      where: { key: 'moderator_rules' },
      select: { value: true },
      take: 1,
    })) as { value: unknown }[]
    if (rows.length > 0 && rows[0].value) {
      const dbConfig = typeof rows[0].value === 'string'
        ? JSON.parse(rows[0].value as string)
        : rows[0].value
      return { ...DEFAULT_MODERATOR_CONFIG, ...(dbConfig as Partial<ModeratorConfig>) }
    }
  } catch (e) {
    console.warn('[moderator] Failed to load config from DB, using defaults:', e)
  }
  return { ...DEFAULT_MODERATOR_CONFIG }
}

/**
 * Get posts published in the last N hours for moderation scanning.
 */
async function getRecentPostsForModeration(config: ModeratorConfig): Promise<
  Array<{ id: string; title: string; content: string; authorId: string; voteCount: number }>
> {
  const cutoff = new Date()
  cutoff.setHours(cutoff.getHours() - config.lookbackHours)

  const posts = (await db.post.findMany({
    where: { createdAt: { gte: cutoff.toISOString() }, status: 'PUBLISHED' },
    select: { id: true, title: true, content: true, authorId: true, voteCount: true },
    orderBy: { createdAt: 'desc' },
    take: config.maxScanPerRun,
  })) as { id: string; title: string; content: string; authorId: string; voteCount: number }[]

  return posts
}

/**
 * Count comments for a post (using findMany, not _count — Supabase REST compatibility).
 */
async function getPostCommentCount(postId: string): Promise<number> {
  try {
    const comments = (await db.comment.findMany({
      where: { postId },
      select: { id: true },
    })) as { id: string }[]
    return comments.length
  } catch {
    return 0
  }
}

/**
 * Extract plain text from EditorJS JSON content.
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
 * Classify post quality into a tier.
 * Phase 1: Trie-based fast screening (ad/spam words + short content → spam)
 * Phase 2: DeepSeek deep evaluation (maps score to quality tier)
 */
async function classifyPostQuality(
  post: { id: string; title: string; content: string },
  config: ModeratorConfig
): Promise<{ tier: QualityTier; score: number; flags: string[] }> {
  const contentText = extractContentText(post.content)

  // Phase 1: Trie fast path — obvious spam patterns
  const trie = getSensitiveWordFilter()
  const hits = trie.search(contentText)
  if (hits.length >= 2 && contentText.length < 150) {
    return { tier: 'spam', score: 100, flags: hits }
  }

  // Phase 2: DeepSeek deep classification
  if (config.deepseekEnabled && process.env.DEEPSEEK_API_KEY) {
    const result = await checkContentQuality(contentText, `标题: ${post.title}`)

    // Map score to quality tier
    let tier: QualityTier = 'normal'
    if (!result.passed || result.score >= 80) {
      tier = 'spam'
    } else if (result.score >= 50) {
      tier = 'low_quality'
    } else if (result.score >= 20) {
      tier = 'normal'
    } else {
      tier = 'high_quality'
    }

    return { tier, score: result.score, flags: result.flags }
  }

  // No DeepSeek — default to normal (conservative)
  return { tier: 'normal', score: 0, flags: [] }
}

/**
 * Decide what action to take based on quality tier + safety checks.
 */
function decideModeratorAction(
  tier: QualityTier,
  commentCount: number,
  voteCount: number,
  config: ModeratorConfig
): { action: ModeratorAction; reason: string } {
  switch (tier) {
    case 'spam': {
      const isProtected =
        voteCount >= config.minVotesForDeleteProtection ||
        commentCount >= config.minCommentsForDeleteProtection
      if (isProtected) {
        return {
          action: 'flag_for_review',
          reason: `Spam detected but protected (votes=${voteCount}, comments=${commentCount})`,
        }
      }
      return { action: 'delete_spam', reason: 'Auto-detected spam/junk post' }
    }

    case 'high_quality':
      return { action: 'feature_quality', reason: 'High-quality content detected' }

    case 'low_quality':
    case 'normal':
    default:
      return { action: 'none', reason: `Tier: ${tier}` }
  }
}

/**
 * Execute a moderator action on a post.
 */
async function executeModeratorAction(
  postId: string,
  action: ModeratorAction,
  autoPin: boolean
): Promise<void> {
  switch (action) {
    case 'delete_spam': {
      await db.post.delete({ where: { id: postId } })
      break
    }

    case 'feature_quality': {
      const data: Record<string, unknown> = {
        isFeatured: true,
        featuredAt: new Date().toISOString(),
      }
      // Check if already pinned
      try {
        const post = (await db.post.findFirst({
          where: { id: postId },
          select: { isPinned: true },
        })) as { isPinned: boolean } | null
        if (autoPin && post && !post.isPinned) {
          data.isPinned = true
          data.pinnedAt = new Date().toISOString()
        }
      } catch {
        // If we can't check, just set featured
      }
      await db.post.update({ where: { id: postId }, data })
      break
    }

    case 'flag_for_review':
    case 'none':
    default:
      // No DB action needed
      break
  }
}

/**
 * Main moderator pipeline entry point.
 * Scans recent posts, classifies quality, and acts on spam/high-quality content.
 */
export async function runModeration(
  maxScanOverride?: number
): Promise<ModeratorReport> {
  const executionId = await createPipelineExecution(
    'ai_moderator',
    'Scheduled moderation run',
    undefined,
    1
  )

  const report: ModeratorReport = {
    postsScanned: 0,
    actionsTaken: { deleted: 0, featured: 0, flagged: 0 },
    details: [],
  }

  try {
    const config = await loadModeratorConfig()
    if (!config.enabled) {
      await markPipelineSuccess(executionId, 'Disabled by config')
      return report
    }

    // Apply override if provided
    if (maxScanOverride) {
      config.maxScanPerRun = Math.min(maxScanOverride, 100)
    }

    const posts = await getRecentPostsForModeration(config)
    report.postsScanned = posts.length

    for (const post of posts) {
      // Classify quality
      const { tier, score, flags } = await classifyPostQuality(post, config)

      // Count comments for safety check
      const commentCount = tier === 'spam'
        ? await getPostCommentCount(post.id)
        : 0

      // Decide action
      const { action, reason } = decideModeratorAction(
        tier,
        commentCount,
        post.voteCount,
        config
      )

      // Execute action
      if (action !== 'none') {
        try {
          await executeModeratorAction(post.id, action, config.autoPinOnFeature)
        } catch (e) {
          console.warn(`[moderator] Failed to execute ${action} on ${post.id}:`, e)
          report.details.push({
            postId: post.id,
            postTitle: post.title.slice(0, 80),
            qualityTier: tier,
            deepseekScore: score,
            action,
            reason: `Execution failed: ${e instanceof Error ? e.message : String(e)}`,
          })
          continue
        }
      }

      // Track action counts
      switch (action) {
        case 'delete_spam':
          report.actionsTaken.deleted++
          break
        case 'feature_quality':
          report.actionsTaken.featured++
          break
        case 'flag_for_review':
          report.actionsTaken.flagged++
          break
      }

      report.details.push({
        postId: post.id,
        postTitle: post.title.slice(0, 80),
        qualityTier: tier,
        deepseekScore: score,
        action,
        reason,
      })
    }

    const summary = [
      report.actionsTaken.deleted > 0 && `${report.actionsTaken.deleted} deleted`,
      report.actionsTaken.featured > 0 && `${report.actionsTaken.featured} featured`,
      report.actionsTaken.flagged > 0 && `${report.actionsTaken.flagged} flagged`,
    ].filter(Boolean).join(', ') || 'no actions taken'

    await markPipelineSuccess(executionId, `${report.postsScanned} scanned — ${summary}`)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[moderator] Moderation run failed:', msg)
    await markPipelineFailed(executionId, msg)
  }

  return report
}
