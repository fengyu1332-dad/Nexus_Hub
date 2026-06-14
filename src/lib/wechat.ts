/**
 * WeChat JSSDK signature utility.
 * Generates signatures for wx.config() on the frontend.
 */

interface WxCache {
  accessToken: string
  accessTokenExpires: number
  jsapiTicket: string
  jsapiTicketExpires: number
}

let cache: WxCache = {
  accessToken: '',
  accessTokenExpires: 0,
  jsapiTicket: '',
  jsapiTicketExpires: 0,
}

function sha1(str: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha1').update(str, 'utf8').digest('hex')
}

function randomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const bytes = require('crypto').randomBytes(length)
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cache.accessToken && now < cache.accessTokenExpires) {
    return cache.accessToken
  }

  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}`
  )
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`WeChat access_token failed: ${JSON.stringify(data)}`)
  }

  cache.accessToken = data.access_token
  cache.accessTokenExpires = now + (data.expires_in - 300) * 1000
  return data.access_token
}

async function getJsapiTicket(): Promise<string> {
  const now = Date.now()
  if (cache.jsapiTicket && now < cache.jsapiTicketExpires) {
    return cache.jsapiTicket
  }

  const token = await getAccessToken()
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${token}&type=jsapi`
  )
  const data = await res.json()
  if (data.errcode !== 0) {
    throw new Error(`WeChat jsapi_ticket failed: ${JSON.stringify(data)}`)
  }

  cache.jsapiTicket = data.ticket
  cache.jsapiTicketExpires = now + (data.expires_in - 300) * 1000
  return data.ticket
}

export interface WxSignature {
  appId: string
  timestamp: number
  nonceStr: string
  signature: string
}

export async function getWxSignature(url: string): Promise<WxSignature> {
  const ticket = await getJsapiTicket()
  const timestamp = Math.floor(Date.now() / 1000)
  const nonceStr = randomString()
  const string1 = `jsapi_ticket=${ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`

  return {
    appId: process.env.WECHAT_APP_ID!,
    timestamp,
    nonceStr,
    signature: sha1(string1),
  }
}
