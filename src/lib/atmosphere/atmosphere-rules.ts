/**
 * Atmosphere Rules — 规则引擎
 *
 * 从 PipelineConfig 中加载可配置规则，判断哪个帖子需要哪些 AI 角色在何时评论。
 */
import { db } from '@/lib/db'
import type {
  AtmosphereConfig,
  AtmosphereAction,
  ExistingAiComment,
} from './types'
import { DEFAULT_ATMOSPHERE_CONFIG } from './types'

/** 从 PipelineConfig 加载配置，失败时返回默认值 */
export async function loadAtmosphereConfig(): Promise<AtmosphereConfig> {
  try {
    const row = await db.pipelineConfig.findFirst({
      where: { key: 'atmosphere_rules' },
      select: { value: true },
    }) as { value: string } | null
    if (row?.value) {
      const parsed = JSON.parse(row.value)
      return { ...DEFAULT_ATMOSPHERE_CONFIG, ...parsed, slots: parsed.slots || DEFAULT_ATMOSPHERE_CONFIG.slots }
    }
  } catch {
    console.warn('[atmosphere-rules] Failed to load config, using defaults')
  }
  return DEFAULT_ATMOSPHERE_CONFIG
}

/**
 * 根据帖子发布时间、已有 AI 评论和当前时间，计算出当前轮次需要执行的动作。
 */
export function getDueActions(
  postCreatedAt: Date,
  existingAiComments: ExistingAiComment[],
  config: AtmosphereConfig,
  now: Date
): AtmosphereAction[] {
  if (!config.enabled) return []

  const hoursSincePost = (now.getTime() - postCreatedAt.getTime()) / (1000 * 60 * 60)

  // 统计当前已有多少 AI 评论
  if (existingAiComments.length >= config.maxCommentsPerPost) return []

  const actions: AtmosphereAction[] = []

  for (let i = 0; i < config.slots.length; i++) {
    const slot = config.slots[i]

    // 检查时间窗口：当前时间是否在此窗口内
    if (hoursSincePost < slot.hoursAfterPost) continue
    if (hoursSincePost > slot.hoursAfterPost + slot.windowHours) continue

    // 检查此角色在此槽位是否已经发表过评论
    if (isSlotFilled(existingAiComments, slot.role)) continue

    // 对于 reply 类型，检查是否有目标角色的评论可以回复
    if (slot.style === 'reply' && slot.replyToRole) {
      const targetComment = findTargetComment(existingAiComments, slot.replyToRole)
      if (targetComment) {
        actions.push({
          type: 'reply',
          role: slot.role,
          style: slot.style,
          postId: '',
          replyToCommentId: targetComment.id,
          replyToRole: targetComment.authorRole as typeof slot.replyToRole,
          slotIndex: i,
        })
      } else {
        actions.push({
          type: 'comment',
          role: slot.role,
          style: 'substantive_comment',
          postId: '',
          slotIndex: i,
        })
      }
    } else {
      actions.push({
        type: 'comment',
        role: slot.role,
        style: slot.style,
        postId: '',
        slotIndex: i,
      })
    }
  }

  // Fallback: 帖子已经超出所有时间窗口，但仍需要氛围评论
  if (actions.length === 0 && hoursSincePost > config.slots[config.slots.length - 1].hoursAfterPost + config.slots[config.slots.length - 1].windowHours) {
    const unfilledSlots = config.slots.filter((s) => !isSlotFilled(existingAiComments, s.role))
    if (unfilledSlots.length > 0) {
      const slotsToFill = Math.min(2, unfilledSlots.length, config.maxCommentsPerPost - existingAiComments.length)
      for (let i = 0; i < slotsToFill; i++) {
        const slot = unfilledSlots[i]
        if (slot.style === 'reply' && slot.replyToRole) {
          const target = findTargetComment(existingAiComments, slot.replyToRole)
          if (target) {
            actions.push({
              type: 'reply', role: slot.role, style: slot.style,
              postId: '', replyToCommentId: target.id,
              replyToRole: target.authorRole as typeof slot.replyToRole,
              slotIndex: config.slots.indexOf(slot),
            })
            continue
          }
        }
        actions.push({
          type: 'comment', role: slot.role, style: 'substantive_comment',
          postId: '', slotIndex: config.slots.indexOf(slot),
        })
      }
    }
  }

  return actions
}

/** 检查指定角色的指定槽位是否已被占用 */
function isSlotFilled(
  existing: ExistingAiComment[],
  role: string
): boolean {
  return existing.some((c) => c.authorRole === role)
}

/** 从已有评论中找到指定角色的评论，用于回复 */
function findTargetComment(
  existing: ExistingAiComment[],
  targetRole: string
): ExistingAiComment | undefined {
  return existing.find((c) => c.authorRole === targetRole && !c.replyToId)
}

/**
 * 判断一篇帖子是否需要/可以进行 AI 氛围评论。
 * 用于数据库查询的预过滤。
 */
export function getPostFilters(config: AtmosphereConfig, now: Date) {
  const lookbackDate = new Date(now.getTime() - config.lookbackDays * 24 * 60 * 60 * 1000)
  // 最早需要氛围评论的时间 = 帖子发布时间 + 第一个 slot 的窗口
  const minAgeHours = config.slots.length > 0 ? config.slots[0].hoursAfterPost : 0.5
  const maxAgeDate = new Date(now.getTime() - minAgeHours * 60 * 60 * 1000)

  return {
    lookbackDate,
    maxAgeDate,
    minAgeHours,
  }
}
