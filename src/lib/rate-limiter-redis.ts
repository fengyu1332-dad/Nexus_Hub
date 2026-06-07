/**
 * =============================================================================
 * Nexus Hub — 生产环境 Rate Limiter (Upstash Redis 版)
 * =============================================================================
 *
 * ⚠️ 此文件为生产环境升级模板，需要先安装依赖：
 *    npm install @upstash/ratelimit @upstash/redis
 *
 * 使用场景: Vercel / 多实例部署
 * 替换方式: 将 /api/chat/route.ts 中的 import 从 rate-limiter 改为此文件
 * 配置: .env 中添加 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */

// 以下为生产环境参考实现。
// 使用时取消注释所有代码，并运行: npm install @upstash/ratelimit @upstash/redis
/*
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
})

// 每分钟 5 次
const minuteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: 'nexus-flora-minute',
})

// 每天 50 次
const dayLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 d'),
  analytics: true,
  prefix: 'nexus-flora-day',
})

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || '127.0.0.1'
}

export async function checkRateLimit(ip: string) {
  const [minuteResult, dayResult] = await Promise.all([
    minuteLimiter.limit(ip),
    dayLimiter.limit(ip),
  ])

  if (!dayResult.success) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: dayResult.reset,
      reason: '每天对话次数已达上限',
    }
  }

  if (!minuteResult.success) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: minuteResult.reset,
      reason: '发送频率过快',
    }
  }

  return {
    allowed: true,
    remaining: Math.min(minuteResult.remaining, dayResult.remaining),
    resetAt: minuteResult.reset,
  }
}

export { rateLimitResponse } from './rate-limiter'
*/
