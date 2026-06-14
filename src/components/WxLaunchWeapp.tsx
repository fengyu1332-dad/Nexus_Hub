'use client'

/**
 * Renders a WeChat mini-program launch button on H5 pages.
 *
 * Requirements:
 * - NEXT_PUBLIC_WECHAT_MINI_APP_ID env var set
 * - Domain registered in WeChat Official Account > JS Security Domain
 * - Mini program bound to the Official Account
 * - WeChatShare component present on page (provides JSSDK config)
 */

interface WxLaunchWeappProps {
  path: string // mini program page path, e.g. '/pages/post/detail?id=xxx'
  label?: string
  className?: string
}

export default function WxLaunchWeapp({
  path,
  label = '在小程序中打开',
  className = '',
}: WxLaunchWeappProps) {
  const miniAppId = process.env.NEXT_PUBLIC_WECHAT_MINI_APP_ID
  if (!miniAppId) return null

  return (
    <div
      className={className}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      dangerouslySetInnerHTML={{
        __html: `
          <wx-open-launch-weapp
            id="launch-btn"
            appid="${miniAppId}"
            path="${path}">
            <script type="text/wxtag-template">
              <style>
                .btn { padding: 8px 20px; background: #07c160; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
              </style>
              <button class="btn">${label}</button>
            </script>
          </wx-open-launch-weapp>
        `,
      }}
    />
  )
}
