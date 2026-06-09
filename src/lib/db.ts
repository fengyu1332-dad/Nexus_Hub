import 'server-only'

// ═══════════════════════════════════════════════════════
//  自动检测运行环境:
//    - 本地 / Docker → 使用 Prisma 直连
//    - Vercel       → 使用 Supabase REST API
// ═══════════════════════════════════════════════════════

const isVercel =
  process.env.VERCEL === '1' ||
  process.env.VERCEL_ENV !== undefined ||
  process.env.USE_SUPABASE_REST === '1'

let _db: any = null

async function getDb() {
  if (_db) return _db

  if (isVercel) {
    const mod = await import('@/lib/db-supabase')
    _db = mod.db
  } else {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    _db = prisma
  }

  return _db
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
