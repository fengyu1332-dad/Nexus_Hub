import { db } from '@/lib/db'

/**
 * Load the active prompt for an agent role from DB.
 * Falls back to the provided static prompt if no active version exists in DB.
 */
export async function loadActivePrompt(
  agentRole: string,
  fallbackPrompt: string
): Promise<string> {
  try {
    const active = await db.promptVersion.findFirst({
      where: { agentRole, isActive: true },
      select: { id: true, content: true, version: true },
    })
    if (active && (active as any).content) {
      return (active as any).content
    }
  } catch {
    // PromptVersion table may not exist yet — fall through to static
  }
  return fallbackPrompt
}
