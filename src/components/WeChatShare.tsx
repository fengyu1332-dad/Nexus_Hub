'use client'

import { useEffect, useRef } from 'react'

interface WeChatShareProps {
  title: string
  description: string
  imageUrl?: string
}

const MINI_APP_ID = process.env.NEXT_PUBLIC_WECHAT_MINI_APP_ID

declare global {
  interface Window {
    wx: any
  }
}

let sdkLoaded = false
let sdkLoadPromise: Promise<void> | null = null

function loadWxSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if ((window as any).wx) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'
    script.async = true
    script.onload = () => {
      sdkLoaded = true
      resolve()
    }
    script.onerror = () => resolve() // Silently fail
    document.head.appendChild(script)
  })
  return sdkLoadPromise
}

export default function WeChatShare({ title, description, imageUrl }: WeChatShareProps) {
  const configured = useRef(false)

  useEffect(() => {
    if (configured.current) return
    configured.current = true

    async function init() {
      await loadWxSdk()
      const wx = (window as any).wx
      if (!wx) return

      try {
        const url = window.location.href.split('#')[0]
        const res = await fetch('/api/wechat/signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        if (!res.ok) return
        const { appId, timestamp, nonceStr, signature } = await res.json()

        const jsApiList = ['updateAppMessageShareData', 'updateTimelineShareData']
        if (MINI_APP_ID) {
          jsApiList.push('openTagList' as any)
        }

        wx.config({
          debug: false,
          appId,
          timestamp,
          nonceStr,
          signature,
          jsApiList,
          ...(MINI_APP_ID ? { openTagList: ['wx-open-launch-weapp'] } : {}),
        })

        wx.ready(() => {
          const shareData = {
            title,
            desc: description,
            link: url,
            imgUrl: imageUrl || `${window.location.origin}/og.png`,
          }
          wx.updateAppMessageShareData(shareData)
          wx.updateTimelineShareData(shareData)
        })
      } catch {
        // Silently fail — WeChat SDK only works inside WeChat browser
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
