/**
 * AI Moderator (Curator) — 类型定义
 *
 * AI-Curator 定期扫描新帖，自动清理垃圾内容并推荐优质帖子为精华。
 */

/** Actions the moderator can take on a post */
export type ModeratorAction = 'delete_spam' | 'feature_quality' | 'flag_for_review' | 'none'

/** Quality tier assigned by content evaluation */
export type QualityTier = 'spam' | 'low_quality' | 'normal' | 'high_quality'

/** JSON config stored in PipelineConfig (key: moderator_rules) */
export interface ModeratorConfig {
  enabled: boolean
  /** Lookback window in hours for scanning recent posts */
  lookbackHours: number
  /** Maximum posts to scan per run */
  maxScanPerRun: number
  /** Safety: posts with votes >= this are protected from deletion */
  minVotesForDeleteProtection: number
  /** Safety: posts with comments >= this are protected from deletion */
  minCommentsForDeleteProtection: number
  /** DeepSeek score <= this qualifies as high quality (0=perfect, 100=worst) */
  featureScoreThreshold: number
  /** Also set isPinned when featuring a post */
  autoPinOnFeature: boolean
  /** Whether to use DeepSeek for quality classification */
  deepseekEnabled: boolean
}

export const DEFAULT_MODERATOR_CONFIG: ModeratorConfig = {
  enabled: true,
  lookbackHours: 2,
  maxScanPerRun: 50,
  minVotesForDeleteProtection: 1,
  minCommentsForDeleteProtection: 3,
  featureScoreThreshold: 20,
  autoPinOnFeature: true,
  deepseekEnabled: true,
}

/** Result of moderating a single post */
export interface ModeratorPostResult {
  postId: string
  postTitle: string
  qualityTier: QualityTier
  deepseekScore: number
  action: ModeratorAction
  reason: string
}

/** Return type of the main runModeration() function */
export interface ModeratorReport {
  postsScanned: number
  actionsTaken: {
    deleted: number
    featured: number
    flagged: number
  }
  details: ModeratorPostResult[]
}
