/**
 * Discussion Atmosphere Builder — 类型定义
 *
 * 三个 AI 角色（Flora/Newton/Midas）按时间线自动对帖子发表评论和相互探讨，
 * 营造多人互动讨论氛围，降低真人用户参与互动的心理门槛。
 */

/** Time slot defining when an AI role should act */
export interface AtmosphereSlot {
  /** Hours after post publication (min) */
  minHours: number
  /** Hours after post publication (max) */
  maxHours: number
  /** AI role */
  role: 'Flora' | 'Newton' | 'Midas'
  /** Top-level comment or reply to another AI */
  style: 'comment' | 'reply'
  /** When style is 'reply', which role's comment to reply to */
  replyTo?: 'Flora' | 'Newton' | 'Midas'
  /** Only fire if at least this many AI comments exist (for reply chaining) */
  requiresExistingCount?: number
}

/** JSON config stored in PipelineConfig table (key: atmosphere_rules) */
export interface AtmosphereConfig {
  enabled: boolean
  /** Lookback window in days for scanning posts */
  lookbackDays: number
  /** Maximum total AI comments per post (including Flora welcome + all atmosphere) */
  maxAiCommentsPerPost: number
  /** Hard cap: max comments created per single pipeline run */
  globalMaxPerRun: number
  /** Probability (0-1) that an AI replies to another AI when a slot matches */
  replyProbability: number
  /** Time slots defining the atmosphere timeline */
  slots: AtmosphereSlot[]
}

/** Default atmosphere config when no PipelineConfig entry exists */
export const DEFAULT_ATMOSPHERE_CONFIG: AtmosphereConfig = {
  enabled: true,
  lookbackDays: 7,
  maxAiCommentsPerPost: 10,
  globalMaxPerRun: 8,
  replyProbability: 0.85,
  slots: [
    // Flora welcome (~30min) handled by existing ai-publish pipeline, not here
    { minHours: 2, maxHours: 6, role: 'Newton', style: 'comment' },
    { minHours: 6, maxHours: 12, role: 'Midas', style: 'comment' },
    { minHours: 12, maxHours: 24, role: 'Flora', style: 'reply', replyTo: 'Newton', requiresExistingCount: 1 },
    { minHours: 24, maxHours: 36, role: 'Newton', style: 'reply', replyTo: 'Midas', requiresExistingCount: 2 },
    { minHours: 36, maxHours: 48, role: 'Midas', style: 'reply', replyTo: 'Newton', requiresExistingCount: 3 },
    { minHours: 54, maxHours: 72, role: 'Flora', style: 'comment', requiresExistingCount: 4 },
  ],
}

/** A concrete action determined by the rules engine */
export interface AtmosphereAction {
  postId: string
  postTitle: string
  postContent: string
  role: 'Flora' | 'Newton' | 'Midas'
  style: 'comment' | 'reply'
  /** Parent comment to reply to (only for style='reply') */
  replyToCommentId?: string
  replyToCommentText?: string
  replyToAuthorRole?: string
  /** Existing AI comments on this post for context */
  existingAiComments: AiCommentContext[]
}

export interface AiCommentContext {
  id: string
  text: string
  authorRole: string
  createdAt: string
  isReplyToId?: string | null
}

/** Result of executing a single atmosphere action */
export interface AtmosphereResult {
  postId: string
  role: string
  action: 'comment' | 'reply' | 'skipped'
  commentId?: string
  commentText?: string
  reason?: string
}

/** Return type of the main buildAtmosphere() function */
export interface AtmosphereReport {
  postsScanned: number
  postsMatched: number
  commentsCreated: number
  details: AtmosphereResult[]
}
