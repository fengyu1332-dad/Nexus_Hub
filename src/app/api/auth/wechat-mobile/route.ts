import { NextRequest, NextResponse } from 'next/server'

// WeChat OAuth for in-WeChat browser (snsapi_userinfo)
// Flow: redirect to WeChat → user approves → WeChat redirects back with code → exchange for token → get userinfo

const WECHAT_OAUTH_BASE = 'https://open.weixin.qq.com/connect/oauth2/authorize'
const WECHAT_TOKEN_URL = 'https://api.weixin.qq.com/sns/oauth2/access_token'
const WECHAT_USERINFO_URL = 'https://api.weixin.qq.com/sns/userinfo'

export async function GET(req: NextRequest) {
  const appId = process.env.WECHAT_APP_ID
  const appSecret = process.env.WECHAT_APP_SECRET
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: 'WeChat not configured' },
      { status: 500 }
    )
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Step 1: No code — redirect to WeChat OAuth
  if (!code) {
    const redirectUri = `${baseUrl}/api/auth/wechat-mobile`
    const scope = 'snsapi_userinfo'
    const authUrl = `${WECHAT_OAUTH_BASE}?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state || 'login'}#wechat_redirect`
    return NextResponse.redirect(authUrl)
  }

  // Step 2: Exchange code for access_token
  try {
    const tokenRes = await fetch(
      `${WECHAT_TOKEN_URL}?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`
    )
    const tokenData = await tokenRes.json()

    if (tokenData.errcode) {
      console.error('[wechat-mobile] Token error:', tokenData)
      return NextResponse.redirect(
        `${baseUrl}/sign-in?error=wechat_auth_failed`
      )
    }

    const { access_token, openid, unionid } = tokenData

    // Step 3: Get userinfo
    const userinfoRes = await fetch(
      `${WECHAT_USERINFO_URL}?access_token=${access_token}&openid=${openid}&lang=zh_CN`
    )
    const userinfo = await userinfoRes.json()

    if (userinfo.errcode) {
      console.error('[wechat-mobile] Userinfo error:', userinfo)
      return NextResponse.redirect(
        `${baseUrl}/sign-in?error=wechat_userinfo_failed`
      )
    }

    // Step 4: Redirect to sign-in page with WeChat user data
    // We encode the user info in the URL for the sign-in page to consume
    const params = new URLSearchParams({
      provider: 'wechat',
      openid: unionid || openid,
      name: userinfo.nickname || '微信用户',
      avatar: userinfo.headimgurl || '',
    })

    return NextResponse.redirect(`${baseUrl}/sign-in?${params.toString()}`)
  } catch (error) {
    console.error('[wechat-mobile] Error:', error)
    return NextResponse.redirect(
      `${baseUrl}/sign-in?error=wechat_server_error`
    )
  }
}
