/**
 * Client-side analytics helper for PostHog event tracking.
 * Safe to call even if PostHog is not configured — silently no-ops.
 */

function getPostHog() {
  if (typeof window === 'undefined') return null
  return (window as any).posthog || null
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  const ph = getPostHog()
  if (!ph) return
  try {
    ph.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    })
  } catch {
    // Silently ignore tracking failures
  }
}

// ── Funnel Events ──────────────────────────────────────

export const AnalyticsEvent = {
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  POST_CREATED: 'post_created',
  COMMENT_CREATED: 'comment_created',
  VOTE_CAST: 'vote_cast',
  COMMUNITY_SUBSCRIBED: 'community_subscribed',
  COMMUNITY_UNSUBSCRIBED: 'community_unsubscribed',
  POST_BOOKMARKED: 'post_bookmarked',
  POST_UNBOOKMARKED: 'post_unbookmarked',
  SEARCH_PERFORMED: 'search_performed',
  FLORA_CHAT_MESSAGE: 'flora_chat_message',
} as const
