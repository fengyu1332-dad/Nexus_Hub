import 'server-only'

// ═══════════════════════════════════════════════════════
//  自动检测运行环境:
//    - 本地 / Docker → 使用 Prisma 直连
//    - Vercel       → 使用 Supabase REST API
// ═══════════════════════════════════════════════════════

const isVercel =
  process.env.VERCEL === '1' ||
  process.env.VERCEL_ENV !== undefined

// USE_SUPABASE_REST=1 仅用于本地测试 REST 适配器
const forceRest = process.env.USE_SUPABASE_REST === '1'

// globalThis 单例 — 防止 Next.js dev 热更新创建多个 Prisma 实例耗尽连接
const globalForDb = globalThis as unknown as {
  _db: any | undefined
  _prisma: any | undefined
}

async function getDb() {
  if (globalForDb._db) return globalForDb._db

  if (isVercel || forceRest) {
    const mod = await import('@/lib/db-supabase')
    globalForDb._db = mod.db
  } else {
    const { PrismaClient } = await import('@prisma/client')
    if (!globalForDb._prisma) {
      globalForDb._prisma = new PrismaClient({ log: ['error'] })
    }
    globalForDb._db = globalForDb._prisma
  }

  return globalForDb._db
}

// 懒加载代理 — 首次调用时初始化
export const db = new Proxy({} as any, {
  get(_, prop) {
    if (prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
      return async (...args: any[]) => {
        const d = await getDb()
        return d[prop](...args)
      }
    }
    return new Proxy({} as any, {
      get(_, method) {
        return async (...args: any[]) => {
          const d = await getDb()
          const model = d[prop]
          if (!model)
            throw new Error(`[db] Unknown model: ${String(prop)}`)
          return model[method](...args)
        }
      },
    })
  },
})
