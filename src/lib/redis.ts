import { Redis } from '@upstash/redis'

const url = process.env.REDIS_URL || ''
const token = process.env.REDIS_SECRET || ''

// Redis 未配置时返回 mock，避免 Vercel 上模块初始化崩溃
const mockRedis = {
  hgetall: async () => null as any,
  hset: async () => 0,
  del: async () => 0,
  ping: async () => 'PONG',
} as unknown as Redis

export const redis: Redis =
  url && token ? new Redis({ url, token }) : mockRedis
