/**
 * WeChat JSSDK signature utility.
 * Generates signatures for wx.config() on the frontend.
 *
 * Token caching uses PipelineConfig table for persistence across
 * Vercel serverless cold starts (vs. in-memory cache that resets).
 */

import { db } from '@/lib/db-supabase'

const ACCESS_TOKEN_KEY = 'wechat_access_token'
const JSAPI_TICKET_KEY = 'wechat_jsapi_ticket'
const EXPIRE_BUFFER_MS = 300_000 // 5 min buffer before actual expiry

interface TokenEntry {
  token: string
  expiresAt: number
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

async function readToken(key: string): Promise<TokenEntry | null> {
  try {
    const row = await db.pipelineConfig.findFirst({ where: { key } })
    if (!row) return null
    const entry = JSON.parse(row.value) as TokenEntry
    if (!entry?.token || typeof entry.expiresAt !== 'number') return null
    return entry
  } catch {
    return null
  }
}

async function writeToken(key: string, entry: TokenEntry): Promise<void> {
  try {
    await db.pipelineConfig.upsert({ key, value: JSON.stringify(entry) })
  } catch {
    // Non-critical — will refetch on next request
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()

  // Try DB-persisted cache first
  const cached = await readToken(ACCESS_TOKEN_KEY)
  if (cached && now < cached.expiresAt) {
    return cached.token
  }

  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.WECHAT_APP_ID}&secret=${process.env.WECHAT_APP_SECRET}`
  )
  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`WeChat access_token failed: ${JSON.stringify(data)}`)
  }

  const entry: TokenEntry = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 300) * 1000,
  }
  // Fire-and-forget: don't block on write
  writeToken(ACCESS_TOKEN_KEY, entry)
  return data.access_token
}

async function getJsapiTicket(): Promise<string> {
  const now = Date.now()

  // Try DB-persisted cache first
  const cached = await readToken(JSAPI_TICKET_KEY)
  if (cached && now < cached.expiresAt) {
    return cached.token
  }

  const token = await getAccessToken()
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${token}&type=jsapi`
  )
  const data = await res.json()
  if (data.errcode !== 0) {
    throw new Error(`WeChat jsapi_ticket failed: ${JSON.stringify(data)}`)
  }

  const entry: TokenEntry = {
    token: data.ticket,
    expiresAt: now + (data.expires_in - 300) * 1000,
  }
  // Fire-and-forget: don't block on write
  writeToken(JSAPI_TICKET_KEY, entry)
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
