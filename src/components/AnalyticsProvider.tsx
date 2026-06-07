'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Nexus Hub — 流量雷达分析埋点
 *
 * 支持 PostHog (推荐) 和 Google Analytics 4 双通道
 * PostHog: 开源产品分析，跟踪用户行为、转化漏斗、Flora 对话
 * GA4: Google 搜索生态必备
 */

// ── PostHog ───────────────────────────────────────

function initPostHog() {
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

  if (!key) return

  // 动态加载 PostHog 脚本（避免 webpack 构建时缺少依赖报错）
  const script = document.createElement('script')
  script.src = 'https://app.posthog.com/static/js/recorder.js'
  script.async = true
  script.onload = () => {
    const ph = (window as any).posthog
    if (ph) {
      ph.init(key, {
        api_host: host,
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        session_recording: { maskAllInputs: true },
      })
    }
  }
  document.head.appendChild(script)
}

// ── Google Analytics ───────────────────────────────

function initGA() {
  if (typeof window === 'undefined') return
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  if (!gaId) return

  const script = document.createElement('script')
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  script.async = true
  document.head.appendChild(script)

  ;(window as any).dataLayer = (window as any).dataLayer || []
  function gtag(...args: any[]) {
    ;(window as any).dataLayer.push(args)
  }
  gtag('js', new Date())
  gtag('config', gaId)
}

// ── Provider ───────────────────────────────────────

export function AnalyticsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 初始化 PostHog
  useEffect(() => {
    initPostHog()
    initGA()
  }, [])

  // 页面浏览追踪
  useEffect(() => {
    if (typeof window === 'undefined') return

    // PostHog pageview
    const posthog = (window as any).posthog
    if (posthog?.capture) {
      posthog.capture('$pageview', {
        path: pathname,
        search: searchParams?.toString() || '',
      })
    }

    // GA4 pageview
    const gtag = (window as any).gtag
    if (gtag) {
      gtag('event', 'page_view', {
        page_path: pathname + (searchParams?.toString() ? `?${searchParams}` : ''),
      })
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
