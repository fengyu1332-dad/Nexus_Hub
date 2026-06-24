/**
 * Discussion Atmosphere Builder — 公共 API
 *
 * 三个 AI 角色（Flora/Newton/Midas）按时间线自动对帖子发表评论和相互探讨。
 */

export { buildAtmosphere } from './atmosphere-builder'
export { loadAtmosphereConfig, getDueActions } from './atmosphere-rules'
export { generateComment } from './comment-generator'
export { getCommentPrompt } from './persona-comments'
export type {
  AtmosphereSlot,
  AtmosphereConfig,
  AtmosphereAction,
  AtmosphereResult,
  AtmosphereReport,
  AiCommentContext,
} from './types'
export { DEFAULT_ATMOSPHERE_CONFIG } from './types'
