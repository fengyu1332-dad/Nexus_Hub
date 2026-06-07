/**
 * Nexus Hub — Persona Calibration Module
 *
 * 统一导出 IP 矩阵人设注入所需的所有资源。
 */

// 黑话字典
export {
  ACADEMIC_SLANG,
  COMPETITION_SLANG,
  LIFESTYLE_SLANG,
  PAIN_POINTS,
  buildSlangInjection,
} from './slang'
export type { SlangEntry, PainPoint } from './slang'

// Newton 人设
export {
  NEWTON_BASE_PROMPT,
  NEWTON_CHAIN_OF_THOUGHT,
  buildNewtonEnhancedPrompt,
} from './newton'

// 多模态内容
export {
  PLATFORM_CONFIGS,
  buildRepurposePrompt,
  parseRepurposedOutput,
  buildArticleWithMultimodal,
} from './content-repurposer'
export type { RepurposedContent } from './content-repurposer'

// Midas SEO
export {
  MIDAS_BASE_PROMPT,
  MIDAS_TITLE_STRATEGY,
  MIDAS_DISTRIBUTION_STRATEGY,
  MIDAS_META_STRATEGY,
  buildMidasEnhancedPrompt,
  scoreSEOTitle,
} from './midas'
