import { db } from '@/lib/db'

interface PromptPerf {
  promptId: string
  agentRole: string
  promptName: string
  version: number
  isActive: boolean
  helpfulRatio: number
  totalFeedback: number
  recentRatio: number
  recentTotal: number
}

/**
 * Evaluate performance of a prompt version based on PostFeedback.
 * Computes overall and recent (7-day) helpful ratios.
 */
export async function evaluatePromptVersion(promptVersionId: string): Promise<{
  helpfulRatio: number
  totalFeedback: number
  recentRatio: number
  recentFeedback: number
}> {
  try {
    const feedback = (await db.postFeedback.findMany({
      where: { promptVersionId: promptVersionId },
      select: { rating: true, createdAt: true },
    }).catch(() => [])) as { rating: string; createdAt: string }[]

    const helpful = feedback.filter((f: any) => f.rating === 'helpful').length
    const total = feedback.length

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recent = feedback.filter((f: any) => new Date(f.createdAt).getTime() > weekAgo)
    const recentHelpful = recent.filter((f: any) => f.rating === 'helpful').length

    return {
      helpfulRatio: total > 0 ? Math.round((helpful / total) * 100) : 0,
      totalFeedback: total,
      recentRatio: recent.length > 0 ? Math.round((recentHelpful / recent.length) * 100) : 0,
      recentFeedback: recent.length,
    }
  } catch {
    return { helpfulRatio: 0, totalFeedback: 0, recentRatio: 0, recentFeedback: 0 }
  }
}

/**
 * Evaluate all prompt versions for a given agent role.
 * Returns sorted by performance (best first).
 */
export async function evaluatePromptVersions(agentRole: string): Promise<PromptPerf[]> {
  try {
    const versions = (await db.promptVersion.findMany({
      where: { agentRole },
      orderBy: { version: 'desc' },
      take: 10,
    }).catch(() => [])) as { id: string; agentRole: string; promptName: string; version: number; isActive: boolean }[]

    if (!versions.length) return []

    const results: PromptPerf[] = []
    for (const v of versions) {
      const perf = await evaluatePromptVersion(v.id)
      results.push({
        promptId: v.id,
        agentRole: v.agentRole,
        promptName: v.promptName,
        version: v.version,
        isActive: v.isActive,
        helpfulRatio: perf.helpfulRatio,
        totalFeedback: perf.totalFeedback,
        recentRatio: perf.recentRatio,
        recentTotal: perf.recentFeedback,
      })
    }

    return results.sort((a, b) => b.helpfulRatio - a.helpfulRatio)
  } catch {
    return []
  }
}

/**
 * Check if the active prompt for a role should be switched.
 * Returns recommended prompt version ID if switching is beneficial.
 *
 * Rules (configurable via PipelineConfig key `prompt_optimization_rules`):
 * - Default: switch if active prompt's recentRatio < 50% AND another version has recentRatio > 50%
 */
export async function shouldSwitchPrompt(agentRole: string): Promise<{
  shouldSwitch: boolean
  currentActiveId: string | null
  recommendedId: string | null
  reason: string
}> {
  const versions = await evaluatePromptVersions(agentRole)

  const active = versions.find((v) => v.isActive)
  if (!active) {
    return {
      shouldSwitch: versions.length > 0,
      currentActiveId: null,
      recommendedId: versions[0]?.promptId || null,
      reason: versions.length > 0 ? 'No active version, recommending best' : 'No versions available',
    }
  }

  // Load thresholds from PipelineConfig
  let minRatio = 50
  try {
    const cfg = await db.pipelineConfig.findFirst({
      where: { key: 'prompt_optimization_rules' },
    }).catch(() => null)
    if (cfg && (cfg as any).value) {
      const rules = JSON.parse((cfg as any).value)
      if (rules?.min_helpful_ratio) minRatio = rules.min_helpful_ratio
    }
  } catch { /* use default */ }

  // Only switch if active has enough feedback to judge AND is underperforming
  if (active.recentTotal < 3) {
    return { shouldSwitch: false, currentActiveId: active.promptId, recommendedId: null, reason: 'Not enough recent feedback to decide' }
  }

  if (active.recentRatio >= minRatio) {
    return { shouldSwitch: false, currentActiveId: active.promptId, recommendedId: null, reason: `Active version performing above threshold (${active.recentRatio}% >= ${minRatio}%)` }
  }

  // Find the best alternative
  const better = versions.find((v) => !v.isActive && v.recentRatio >= minRatio && v.recentTotal >= 3)

  if (better) {
    return {
      shouldSwitch: true,
      currentActiveId: active.promptId,
      recommendedId: better.promptId,
      reason: `Switch from v${active.version} (${active.recentRatio}%) to v${better.version} (${better.recentRatio}%)`,
    }
  }

  return {
    shouldSwitch: false,
    currentActiveId: active.promptId,
    recommendedId: null,
    reason: `Active underperforming (${active.recentRatio}%) but no better alternative available`,
  }
}

/**
 * Auto-switch active prompt version for a role.
 * Deactivates the current and activates the recommendation.
 */
export async function autoOptimizePrompt(agentRole: string): Promise<{
  switched: boolean
  fromVersion: number | null
  toVersion: number | null
  message: string
}> {
  const decision = await shouldSwitchPrompt(agentRole)

  if (!decision.shouldSwitch || !decision.recommendedId) {
    return { switched: false, fromVersion: null, toVersion: null, message: decision.reason }
  }

  try {
    // Deactivate current
    if (decision.currentActiveId) {
      await db.promptVersion.update({
        where: { id: decision.currentActiveId },
        data: { isActive: false },
      }).catch(() => {})
    }

    // Activate new
    await db.promptVersion.update({
      where: { id: decision.recommendedId },
      data: { isActive: true },
    })

    // Get version numbers for the message
    const [oldV, newV] = await Promise.all([
      decision.currentActiveId
        ? db.promptVersion.findFirst({ where: { id: decision.currentActiveId }, select: { version: true } }).catch(() => null)
        : Promise.resolve(null),
      db.promptVersion.findFirst({ where: { id: decision.recommendedId }, select: { version: true } }).catch(() => null),
    ])

    return {
      switched: true,
      fromVersion: (oldV as any)?.version || null,
      toVersion: (newV as any)?.version || null,
      message: decision.reason,
    }
  } catch (err: any) {
    return { switched: false, fromVersion: null, toVersion: null, message: `Failed to switch: ${err.message}` }
  }
}
