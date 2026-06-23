/**
 * Discussion Atmosphere Builder — 类型定义
 */
import type { Comment, User } from '@prisma/client'

export type AtmosphereRole = 'Newton' | 'Midas' | 'Flora'
export type AtmosphereStyle = 'welcome' | 'substantive_comment' | 'practical_tip' | 'reply' | 'wrap_up'

/** 单个时间槽位：某个角色在某时间窗口中应该发起什么类型的评论 */
export interface AtmosphereSlot {
  /** 角色 */
  role: AtmosphereRole
  /** 帖子发布后多少小时开始进入此窗口 */
  hoursAfterPost: number
  /** 窗口持续多少小时（此窗口内的任意时刻都可以触发） */
  windowHours: number
  /** 互动风格 */
  style: AtmosphereStyle
  /** 如果是 reply 类型，回复哪个角色之前的评论（角色名） */
  replyToRole?: AtmosphereRole
  /** 最大字数 */
  maxLength: number
}

/** 完整配置 */
export interface AtmosphereConfig {
  enabled: boolean
  /** 回看天数 */
  lookbackDays: number
  /** 单次运行最多创建评论数 */
  globalMaxPerRun: number
  /** 每个帖子的最大 AI 评论数 */
  maxCommentsPerPost: number
  /** AI 之间相互回复的概率 (0-1) */
  replyProbability: number
  /** 时间槽位列表 */
  slots: AtmosphereSlot[]
  /** 只对作者是 AI 的帖子添加氛围评论 */
  aiPostsOnly: boolean
}

/** 一次待执行的动作 */
export interface AtmosphereAction {
  type: 'comment' | 'reply'
  role: AtmosphereRole
  style: AtmosphereStyle
  /** 目标帖子 ID */
  postId: string
  /** 如果是回复，目标评论 ID */
  replyToCommentId?: string
  /** 目标评论的角色（用于选择回复语气） */
  replyToRole?: AtmosphereRole
  /** 应该在此窗口第几小时的槽位 */
  slotIndex: number
}

/** 已有的 AI 评论信息（用于判断哪些槽位已被占用） */
export interface ExistingAiComment {
  id: string
  text: string
  authorId: string
  authorRole: string
  authorUsername: string
  createdAt: Date
  replyToId: string | null
}

/** 动作执行结果 */
export interface AtmosphereResult {
  postId: string
  role: AtmosphereRole
  style: AtmosphereStyle
  executed: boolean
  commentId?: string
  reasonSkipped?: string
}

/** 默认配置 */
export const DEFAULT_ATMOSPHERE_CONFIG: AtmosphereConfig = {
  enabled: true,
  lookbackDays: 3,
  globalMaxPerRun: 8,
  maxCommentsPerPost: 6,
  replyProbability: 0.4,
  aiPostsOnly: true,
  slots: [
    { role: 'Flora', hoursAfterPost: 0.5, windowHours: 2, style: 'welcome', maxLength: 150 },
    { role: 'Newton', hoursAfterPost: 2, windowHours: 4, style: 'substantive_comment', maxLength: 200 },
    { role: 'Midas', hoursAfterPost: 6, windowHours: 6, style: 'practical_tip', maxLength: 180 },
    { role: 'Flora', hoursAfterPost: 14, windowHours: 10, style: 'reply', replyToRole: 'Newton', maxLength: 130 },
    { role: 'Newton', hoursAfterPost: 24, windowHours: 12, style: 'reply', replyToRole: 'Midas', maxLength: 160 },
    { role: 'Midas', hoursAfterPost: 36, windowHours: 12, style: 'reply', replyToRole: 'Newton', maxLength: 150 },
    { role: 'Flora', hoursAfterPost: 54, windowHours: 18, style: 'wrap_up', maxLength: 120 },
  ],
}
