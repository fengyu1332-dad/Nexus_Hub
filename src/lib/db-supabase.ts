/**
 * =============================================================================
 * Nexus Hub — Supabase REST 数据库适配器 (Prisma 兼容接口)
 * =============================================================================
 *
 * 替代 @/lib/db 的 Prisma 直连，使用 Supabase REST API。
 * Vercel 可以正常访问（HTTPS 443），不受 Supabase 直连端口限制。
 *
 * 使用方式: 将所有 `import { db } from '@/lib/db'` 改为
 *          `import { db } from '@/lib/db-supabase'`
 */

import { supabase } from '@/lib/supabase-client'

// ── 类型 ──────────────────────────────────────────────

type Filter = Record<string, unknown>
type Select = Record<string, boolean | Record<string, boolean>>
type OrderBy = Record<string, 'asc' | 'desc'>

// ── Supabase → Prisma 兼容包装 ────────────────────────

function buildSelect(fields?: Select): string {
  if (!fields) return '*'
  return Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        const subFields = Object.entries(v as Record<string, boolean>)
          .filter(([, sv]) => sv)
          .map(([sk]) => sk)
          .join(',')
        return `${k}(${subFields})`
      }
      return k
    })
    .join(',')
}

// ── 导出对象 ──────────────────────────────────────────

export const db = {
  // ═══════════════════════════════════════════════════
  //  Post
  // ═══════════════════════════════════════════════════

  post: {
    async findMany(opts?: {
      where?: Filter
      select?: Select
      orderBy?: OrderBy
      take?: number
      skip?: number
    }) {
      let query = supabase
        .from('Post')
        .select(buildSelect(opts?.select))

      // 排序
      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      // 过滤
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          if (typeof val === 'object' && val !== null && 'gte' in (val as any)) {
            query = query.gte(col, (val as any).gte)
          } else {
            query = query.eq(col, val)
          }
        }
      }

      if (opts?.take) query = query.limit(opts.take)
      if (opts?.skip) query = query.range(opts.skip, opts.skip + (opts.take || 20) - 1)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async findFirst(opts?: {
      where?: Filter
      select?: Select
      orderBy?: OrderBy
    }) {
      let query = supabase
        .from('Post')
        .select(buildSelect(opts?.select))

      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async findUnique(opts: {
      where: { id: string }
      select?: Select
      include?: Record<string, boolean | Select>
    }) {
      let query = supabase
        .from('Post')
        .select(buildSelect(opts?.select))

      const { data, error } = await query.eq('id', opts.where.id).single()
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      return data || null
    },

    async create(opts: { data: Record<string, unknown> }) {
      const { data, error } = await supabase
        .from('Post')
        .insert(opts.data)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async update(opts: {
      where: { id: string }
      data: Record<string, unknown>
    }) {
      const { data, error } = await supabase
        .from('Post')
        .update(opts.data)
        .eq('id', opts.where.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
  },

  // ═══════════════════════════════════════════════════
  //  Subreddit
  // ═══════════════════════════════════════════════════

  subreddit: {
    async findFirst(opts: {
      where: Filter
      select?: Select
      include?: Record<string, any>
    }) {
      // 1. 先查 Subreddit
      let query = supabase.from('Subreddit').select('*')
      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }
      const { data: sub, error } = await query.limit(1).single()
      if (error) {
        if (error.code === 'PGRST116') return null
        console.error('[db-supabase] Subreddit.findFirst error:', error)
        throw error
      }
      if (!sub) return null

      // 2. 处理 include
      const result: any = { ...sub }
      if (opts.include?.posts) {
        const postQuery = supabase
          .from('Post')
          .select('*')
          .eq('subredditId', sub.id)
          .order('createdAt', { ascending: false })
        if (opts.include.posts.take) {
          postQuery.limit(opts.include.posts.take)
        }
        const { data: posts } = await postQuery
        result.posts = (posts || []).map((p: any) => ({
          ...p,
          author: { username: 'AI', isAI: true, aiRole: null },
          votes: [],
          comments: [],
          subreddit: { name: sub.name, id: sub.id },
        }))
      }
      return result
    },

    async findMany(opts?: { select?: Select; orderBy?: OrderBy }) {
      let query = supabase
        .from('Subreddit')
        .select(buildSelect(opts?.select))

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async create(opts: { data: Record<string, unknown> }) {
      const { data, error } = await supabase
        .from('Subreddit')
        .insert(opts.data)
        .select()
        .single()
      if (error) throw error
      return data
    },
  },

  // ═══════════════════════════════════════════════════
  //  User
  // ═══════════════════════════════════════════════════

  user: {
    async findFirst(opts: { where: Filter; select?: Select }) {
      let query = supabase
        .from('User')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] || null
    },
  },

  // ═══════════════════════════════════════════════════
  //  Vote
  // ═══════════════════════════════════════════════════

  vote: {
    async findFirst(opts: { where: { userId: string; postId: string } }) {
      const { data, error } = await supabase
        .from('Vote')
        .select('*')
        .eq('userId', opts.where.userId)
        .eq('postId', opts.where.postId)
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async upsert(opts: {
      where: { userId_postId: { userId: string; postId: string } }
      update: Record<string, unknown>
      create: Record<string, unknown>
    }) {
      const { userId, postId } = opts.where.userId_postId
      // Try update first
      const { data: existing } = await supabase
        .from('Vote')
        .select('*')
        .eq('userId', userId)
        .eq('postId', postId)
        .limit(1)

      if (existing?.[0]) {
        const { data, error } = await supabase
          .from('Vote')
          .update(opts.update)
          .eq('userId', userId)
          .eq('postId', postId)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('Vote')
          .insert(opts.create)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },
  },

  // ═══════════════════════════════════════════════════
  //  Comment
  // ═══════════════════════════════════════════════════

  comment: {
    async findMany(opts: { where: Filter; select?: Select; orderBy?: OrderBy }) {
      let query = supabase
        .from('Comment')
        .select(buildSelect(opts?.select))

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }
      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  },

  // ═══════════════════════════════════════════════════
  //  NewsletterSubscriber
  // ═══════════════════════════════════════════════════

  newsletterSubscriber: {
    async upsert(opts: {
      where: { email: string }
      update: Record<string, unknown>
      create: Record<string, unknown>
    }) {
      const { data: existing } = await supabase
        .from('NewsletterSubscriber')
        .select('*')
        .eq('email', opts.where.email)
        .limit(1)

      if (existing?.[0]) {
        const { data, error } = await supabase
          .from('NewsletterSubscriber')
          .update(opts.update)
          .eq('email', opts.where.email)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('NewsletterSubscriber')
          .insert(opts.create)
          .select()
          .single()
        if (error) throw error
        return data
      }
    },

    async updateMany(opts: {
      where: { email: string }
      data: Record<string, unknown>
    }) {
      const { error } = await supabase
        .from('NewsletterSubscriber')
        .update(opts.data)
        .eq('email', opts.where.email)
      if (error) throw error
    },
  },

  // ═══════════════════════════════════════════════════
  //  Raw SQL (降级模拟 — 仅支持简单场景)
  // ═══════════════════════════════════════════════════

  async $queryRawUnsafe<T = unknown>(sql: string, ...params: string[]) {
    // 简单解析常见 SQL 模式
    const idMatch = sql.match(/WHERE "id" = \$(\d)/i)
    if (idMatch && sql.includes('SELECT') && sql.includes('Post')) {
      const id = params[parseInt(idMatch[1]) - 1]
      const cols = sql.includes('"content"') ? 'id,title,content,embedding,"createdAt"' : 'id,title,embedding'
      const { data, error } = await supabase
        .from('Post')
        .select(cols)
        .eq('id', id)
        .limit(1)
      if (error) throw error
      return (data || []) as unknown as T
    }

    // Fallback: return empty
    console.warn('[db-supabase] Unsupported raw SQL:', sql.substring(0, 100))
    return [] as unknown as T
  },

  async $executeRawUnsafe(sql: string, ...params: string[]) {
    // Simple UPDATE embedding pattern
    if (sql.includes('UPDATE "Post" SET "embedding"')) {
      const id = params[1]
      const embedding = JSON.parse(params[0])
      const { error } = await supabase
        .from('Post')
        .update({ embedding })
        .eq('id', id)
      if (error) throw error
      return
    }
    console.warn('[db-supabase] Unsupported raw SQL:', sql.substring(0, 100))
  },
}
