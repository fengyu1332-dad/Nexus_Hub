/**
 * WeChat JSSDK signature utility.
 * Generates signatures for wx.config() on the frontend.
 *
 * Token caching uses PipelineConfig table for persistence across
 * Vercel serverless cold starts (vs. in-memory cache that resets).
 */

import { db } from '@/lib/db'

const ACCESS_TOKEN_KEY = 'wechat_access_token'
const JSAPI_TICKET_KEY = 'wechat_jsapi_ticket'

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

// In-memory cache (per-serverless-instance, falls back gracefully)
const memoryCache = new Map<string, TokenEntry>()

async function readToken(key: string): Promise<TokenEntry | null> {
  // Try memory cache first
  const memCached = memoryCache.get(key)
  if (memCached && Date.now() < memCached.expiresAt) {
    return memCached
  }

  // Try DB-persisted cache (non-critical — fail silently)
  try {
    const row = await db.pipelineConfig.findFirst({ where: { key } })
    if (row) {
      const entry = JSON.parse(row.value) as TokenEntry
      if (entry?.token && typeof entry.expiresAt === 'number') {
        memoryCache.set(key, entry)
        return entry
      }
    }
  } catch {
    // PipelineConfig table may not exist — that's fine
  }
  return null
}

async function writeToken(key: string, entry: TokenEntry): Promise<void> {
  memoryCache.set(key, entry)
  try {
    await db.pipelineConfig.upsert({ key, value: JSON.stringify(entry) })
  } catch {
    // Non-critical — memory cache will serve until cold start
  }
}

async function getAccessToken(): Promise<string> {
  const cached = await readToken(ACCESS_TOKEN_KEY)
  if (cached) return cached.token

  if (!process.env.WECHAT_APP_ID || !process.env.WECHAT_APP_SECRET) {
    throw new Error('WeChat credentials not configured')
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
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  }
  writeToken(ACCESS_TOKEN_KEY, entry)
  return data.access_token
}

async function getJsapiTicket(): Promise<string> {
  const cached = await readToken(JSAPI_TICKET_KEY)
  if (cached) return cached.token

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
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  }
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
