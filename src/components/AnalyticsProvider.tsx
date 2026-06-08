'use client'

import { useEffect } from 'react'

/**
 * Nexus Hub — 流量雷达分析埋点
 *
 * 支持 PostHog (推荐) 和 Google Analytics 4 双通道
 * 无需 Suspense 边界，纯 script 注入，零依赖
 */

function initPostHog() {
  if (typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'

  if (!key) return

  const script = document.createElement('script')
  script.src = 'https://app.posthog.com/static/js/recorder.js'
  script.async = true
  script.onload = () => {
    const ph = (window as any).posthog
    if (ph) {
      ph.init(key, {
        api_host: host,
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        session_recording: { maskAllInputs: true },
      })
    }
  }
  document.head.appendChild(script)
}

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
  gtag('config', gaId, { send_page_view: true })
}

export function AnalyticsProvider() {
  useEffect(() => {
    initPostHog()
    initGA()
  }, [])

  return null
}
