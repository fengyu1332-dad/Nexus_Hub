// ── Reputation System Constants ──────────────────────────

export const REPUTATION = {
  POST_CREATED: 10,
  COMMENT_CREATED: 3,
  POST_UPVOTED: 2, // awarded to post author
  COMMENT_UPVOTED: 1, // awarded to comment author
  POST_BOOKMARKED: 1, // awarded to post author when bookmarked
} as const

// ── Level Thresholds ─────────────────────────────────────

const LEVEL_THRESHOLDS = [0, 50, 150, 400, 1000]

export const LEVEL_LABELS: Record<number, string> = {
  1: '种子用户',
  2: '活跃成员',
  3: '资深成员',
  4: '核心贡献者',
  5: '社区长老',
}

export function computeLevel(reputation: number): number {
  let level = 1
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (reputation >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
      break
    }
  }
  return level
}

export function getLevelLabel(level: number): string {
  return LEVEL_LABELS[level] || `Lv.${level}`
}

export function getNextLevelProgress(reputation: number): {
  current: number
  next: number
  currentLevel: number
  nextLabel: string
  percent: number
} {
  const level = computeLevel(reputation)
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0
  const nextThreshold = LEVEL_THRESHOLDS[level] || currentThreshold + 500
  const progress = reputation - currentThreshold
  const range = nextThreshold - currentThreshold
  return {
    current: reputation,
    next: nextThreshold,
    currentLevel: level,
    nextLabel: getLevelLabel(Math.min(level + 1, 5)),
    percent: range > 0 ? Math.min(100, Math.round((progress / range) * 100)) : 100,
  }
}
