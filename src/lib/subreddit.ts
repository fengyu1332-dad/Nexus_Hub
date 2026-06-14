/**
 * 获取板块的显示名称。优先使用 displayName（中文），回退到 name（slug）。
 */
export function getDisplayName(
  name: string,
  displayName?: string | null
): string {
  return displayName || name
}
