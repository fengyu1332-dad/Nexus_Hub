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

// ── ID 生成 ──────────────────────────────────────────

let _counter = 0
function generateId(): string {
  _counter++
  return `c_${Date.now().toString(36)}_${_counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Supabase → Prisma 兼容包装 ────────────────────────

function buildSelect(fields?: Select): string {
  if (!fields) return '*'
  return Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        // Handle Prisma-style nested select: { author: { select: { username: true } } }
        const inner = v as Record<string, unknown>
        if (inner.select && typeof inner.select === 'object') {
          const subFields = Object.entries(inner.select as Record<string, boolean>)
            .filter(([, sv]) => sv)
            .map(([sk]) => sk)
            .join(',')
          return `${k}(${subFields})`
        }
        // Handle flat boolean: { author: true }
        const subFields = Object.entries(inner)
          .filter(([, sv]) => sv)
          .map(([sk]) => sk)
          .join(',')
        return subFields ? `${k}(${subFields})` : k
      }
      return k
    })
    .join(',')
}

// ── Include 批量解析 ─────────────────────────────────

async function resolvePostIncludes(
  posts: any[],
  include?: Record<string, any>
): Promise<any[]> {
  if (!include) return posts

  const postIds = posts.map((p: any) => p.id)

  // Collect unique subreddit IDs — batch with `in`
  const subMap = new Map<string, any>()
  if (include.subreddit) {
    const subIds = [...new Set(posts.map((p: any) => p.subredditId).filter(Boolean))]
    if (subIds.length > 0) {
      const { data: subs } = await supabase
        .from('Subreddit')
        .select('*')
        .in('id', subIds)
      for (const s of subs || []) {
        if (s) subMap.set(s.id, s)
      }
    }
  }

  // Collect unique author IDs — batch with `in`
  const authorMap = new Map<string, any>()
  if (include.author) {
    const authorIds = [...new Set(posts.map((p: any) => p.authorId).filter(Boolean))]
    if (authorIds.length > 0) {
      const { data: users } = await supabase
        .from('User')
        .select('*')
        .in('id', authorIds)
      for (const u of users || []) {
        if (u) authorMap.set(u.id, u)
      }
    }
  }

  // Fetch votes for all posts
  let allVotes: any[] = []
  if (include.votes) {
    const { data } = await supabase
      .from('Vote')
      .select('*')
      .in('postId', postIds)
    allVotes = data || []
  }

  // Fetch comments for all posts
  let allComments: any[] = []
  if (include.comments) {
    const { data } = await supabase
      .from('Comment')
      .select('*')
      .in('postId', postIds)
      allComments = data || []
  }

  return posts.map((p: any) => ({
    ...p,
    subreddit: include.subreddit ? subMap.get(p.subredditId) || null : undefined,
    author: include.author ? authorMap.get(p.authorId) || null : undefined,
    votes: include.votes ? allVotes.filter((v: any) => v.postId === p.id) : undefined,
    comments: include.comments ? allComments.filter((c: any) => c.postId === p.id) : undefined,
  }))
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
          if (typeof val === 'object' && val !== null && 'startsWith' in (val as any)) {
            query = query.ilike(col, `${(val as any).startsWith}%`)
          } else if (typeof val === 'object' && val !== null && 'gte' in (val as any)) {
            query = query.gte(col, (val as any).gte)
          } else if (typeof val === 'object' && val !== null && 'in' in (val as any)) {
            query = query.in(col, (val as any).in)
          } else {
            query = query.eq(col, val)
          }
        }
      }

      if (opts?.take) query = query.limit(opts.take)
      if (opts?.skip) query = query.range(opts.skip, opts.skip + (opts.take || 20) - 1)

      const { data: posts, error } = await query
      if (error) throw error
      if (!posts?.length) return []

      // Resolve include relations (batch)
      return resolvePostIncludes(posts, opts?.include)
    },

    async findFirst(opts?: {
      where?: Filter
      select?: Select
      include?: Record<string, any>
      orderBy?: OrderBy
    }) {
      let query = supabase
        .from('Post')
        .select(buildSelect(opts?.select))

      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          if (typeof val === 'object' && val !== null && 'startsWith' in (val as any)) {
            query = query.ilike(col, `${(val as any).startsWith}%`)
          } else {
            query = query.eq(col, val)
          }
        }
      }
      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      const { data, error } = await query.limit(1)
      if (error) throw error
      const post = data?.[0] || null
      if (!post) return null

      // Resolve include relations
      const result: any = { ...post }
      if (opts?.include?.author) {
        const { data: userData } = await supabase
          .from('User')
          .select('*')
          .eq('id', post.authorId)
          .limit(1)
        result.author = userData?.[0] || null
      }
      if (opts?.include?.votes) {
        const { data: votesData } = await supabase
          .from('Vote')
          .select('*')
          .eq('postId', post.id)
        result.votes = votesData || []
      }
      if (opts?.include?.subreddit) {
        const { data: subData } = await supabase
          .from('Subreddit')
          .select('*')
          .eq('id', post.subredditId)
          .limit(1)
        result.subreddit = subData?.[0] || null
      }
      return result
    },

    async findUnique(opts: {
      where: { id: string }
      select?: Select
      include?: Record<string, boolean | Select>
    }) {
      let query = supabase
        .from('Post')
        .select(buildSelect(opts?.select))

      const { data: post, error } = await query.eq('id', opts.where.id).single()
      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
      if (!post) return null

      // Resolve include relations
      const result: any = { ...post }
      if (opts?.include?.votes) {
        const { data: votesData } = await supabase
          .from('Vote')
          .select('*')
          .eq('postId', post.id)
        result.votes = votesData || []
      }
      if (opts?.include?.author) {
        const { data: userData } = await supabase
          .from('User')
          .select('*')
          .eq('id', post.authorId)
          .limit(1)
        result.author = userData?.[0] || null
      }
      return result
    },

    async create(opts: { data: Record<string, unknown> }) {
      const now = new Date().toISOString()
      const record = { id: generateId(), createdAt: now, updatedAt: now, ...opts.data }
      const { data, error } = await supabase
        .from('Post')
        .insert(record)
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

    async count(opts?: { where?: Filter }) {
      let query = supabase
        .from('Post')
        .select('id', { count: 'exact', head: true })
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },

    async delete(opts: { where: { id: string } }) {
      const { error } = await supabase
        .from('Post')
        .delete()
        .eq('id', opts.where.id)
      if (error) throw error
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
        if (typeof val === 'object' && val !== null && 'startsWith' in (val as any)) {
          query = query.ilike(col, `${(val as any).startsWith}%`)
        } else {
          query = query.eq(col, val)
        }
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

        // Dynamic orderBy from include.posts.orderBy
        const postsOrderBy = opts.include.posts.orderBy
        if (postsOrderBy) {
          for (const [col, dir] of Object.entries(postsOrderBy)) {
            postQuery.order(col, { ascending: dir === 'asc' })
          }
        } else {
          postQuery.order('createdAt', { ascending: false })
        }

        if (opts.include.posts.take) {
          postQuery.limit(opts.include.posts.take)
        }
        const { data: posts } = await postQuery

        // Batch-resolve post authors with single `in` query
        const authorIds = [
          ...new Set(
            (posts || [])
              .map((p: any) => p.authorId)
              .filter(Boolean),
          ),
        ]
        const authorMap = new Map()
        if (authorIds.length > 0) {
          const { data: usersData } = await supabase
            .from('User')
            .select('id,username,isAI,aiRole')
            .in('id', authorIds)
          for (const u of usersData || []) {
            if (u) authorMap.set(u.id, u)
          }
        }

        result.posts = (posts || []).map((p: any) => ({
          ...p,
          author:
            authorMap.get(p.authorId) || {
              username: 'Unknown',
              isAI: false,
              aiRole: null,
            },
          votes: [],
          comments: [],
          subreddit: { name: sub.name, id: sub.id },
        }))
      }
      return result
    },

    async findMany(opts?: { where?: Filter; select?: Select; orderBy?: OrderBy; take?: number; include?: Record<string, any> }) {
      let query = supabase
        .from('Subreddit')
        .select(buildSelect(opts?.select))

      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          if (typeof val === 'object' && val !== null && 'startsWith' in (val as any)) {
            query = query.ilike(col, `${(val as any).startsWith}%`)
          } else if (typeof val === 'object' && val !== null && 'in' in (val as any)) {
            query = query.in(col, (val as any).in)
          } else {
            query = query.eq(col, val)
          }
        }
      }

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      if (opts?.take) query = query.limit(opts.take)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async create(opts: { data: Record<string, unknown> }) {
      const now = new Date().toISOString()
      const record = { id: generateId(), createdAt: now, updatedAt: now, ...opts.data }
      const { data, error } = await supabase
        .from('Subreddit')
        .insert(record)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async count(opts?: { where?: Filter }) {
      let query = supabase
        .from('Subreddit')
        .select('id', { count: 'exact', head: true })
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
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

    async findMany(opts: {
      where?: Filter
      select?: Select
      orderBy?: OrderBy
      take?: number
      skip?: number
    }) {
      let query = supabase
        .from('User')
        .select(buildSelect(opts?.select))

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          if (typeof val === 'object' && val !== null && 'contains' in (val as any)) {
            query = query.ilike(col, `%${(val as any).contains}%`)
          } else if (typeof val === 'object' && val !== null && 'in' in (val as any)) {
            query = query.in(col, (val as any).in)
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

    async count(opts?: { where?: Filter }) {
      let query = supabase
        .from('User')
        .select('id', { count: 'exact', head: true })
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },

    async create(opts: { data: Record<string, unknown> }) {
      const record = { id: generateId(), ...opts.data }
      const { data, error } = await supabase
        .from('User')
        .insert(record)
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
        .from('User')
        .update(opts.data)
        .eq('id', opts.where.id)
        .select()
        .single()
      if (error) throw error
      return data
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

    async delete(opts: {
      where: { userId_postId: { userId: string; postId: string } }
    }) {
      const { userId, postId } = opts.where.userId_postId
      const { error } = await supabase
        .from('Vote')
        .delete()
        .eq('userId', userId)
        .eq('postId', postId)
      if (error) throw error
    },

    async update(opts: {
      where: { userId_postId: { userId: string; postId: string } }
      data: Record<string, unknown>
    }) {
      const { userId, postId } = opts.where.userId_postId
      const { data, error } = await supabase
        .from('Vote')
        .update(opts.data)
        .eq('userId', userId)
        .eq('postId', postId)
        .select()
        .single()
      if (error) throw error
      return data
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

    async findFirst(opts: { where: Filter; select?: Select }) {
      let query = supabase
        .from('Comment')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async create(opts: { data: Record<string, unknown> }) {
      const record = { id: generateId(), createdAt: new Date().toISOString(), ...opts.data }
      const { data, error } = await supabase
        .from('Comment')
        .insert(record)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async count(opts?: { where?: Filter }) {
      let query = supabase
        .from('Comment')
        .select('id', { count: 'exact', head: true })
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },
  },

  // ═══════════════════════════════════════════════════
  //  NewsletterSubscriber
  // ═══════════════════════════════════════════════════

  newsletterSubscriber: {
    async findMany(opts: { where: Filter; select?: Select }) {
      let query = supabase
        .from('NewsletterSubscriber')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

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
        const record = { id: generateId(), subscribedAt: new Date().toISOString(), ...opts.create }
        const { data, error } = await supabase
          .from('NewsletterSubscriber')
          .insert(record)
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
  //  Subscription
  // ═══════════════════════════════════════════════════

  subscription: {
    async findFirst(opts: { where: Filter; select?: Select }) {
      let query = supabase
        .from('Subscription')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async findMany(opts: { where: Filter; select?: Select }) {
      let query = supabase
        .from('Subscription')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async create(opts: { data: Record<string, unknown> }) {
      const { data, error } = await supabase
        .from('Subscription')
        .insert(opts.data)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async delete(opts: {
      where: { userId_subredditId: { userId: string; subredditId: string } }
    }) {
      const { userId, subredditId } = opts.where.userId_subredditId
      const { error } = await supabase
        .from('Subscription')
        .delete()
        .eq('userId', userId)
        .eq('subredditId', subredditId)
      if (error) throw error
    },
  },

  // ═══════════════════════════════════════════════════
  //  Notification
  // ═══════════════════════════════════════════════════

  notification: {
    async findMany(opts: {
      where: Filter
      orderBy?: OrderBy | OrderBy[]
      take?: number
      include?: Record<string, any>
    }) {
      let query = supabase
        .from('Notification')
        .select(buildSelect(opts?.include ? undefined : undefined))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      // Handle orderBy as object or array
      const orders = Array.isArray(opts.orderBy)
        ? opts.orderBy
        : opts.orderBy ? [opts.orderBy] : []
      for (const o of orders) {
        for (const [col, dir] of Object.entries(o)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      if (opts?.take) query = query.limit(opts.take)

      const { data, error } = await query
      if (error) throw error

      // Resolve include.fromUser — batch with single `in` query
      if (opts?.include?.fromUser && data) {
        const userIds = [...new Set(data.map((n: any) => n.fromUserId))]
        const userMap = new Map()
        if (userIds.length > 0) {
          const { data: users } = await supabase
            .from('User')
            .select('username,image')
            .in('id', userIds)
          for (const u of users || []) {
            if (u) userMap.set(u.id, u)
          }
        }
        return data.map((n: any) => ({
          ...n,
          fromUser: userMap.get(n.fromUserId) || { username: null, image: null },
        }))
      }

      return data || []
    },

    async create(opts: { data: Record<string, unknown> }) {
      const record = { id: generateId(), createdAt: new Date().toISOString(), read: false, ...opts.data }
      const { data, error } = await supabase
        .from('Notification')
        .insert(record)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async count(opts: { where: Filter }) {
      const { count, error } = await supabase
        .from('Notification')
        .select('id', { count: 'exact', head: true })
        .eq('userId', opts.where.userId as string)
        .eq('read', opts.where.read as boolean)
      if (error) throw error
      return count || 0
    },

    async update(opts: { where: { id: string }; data: Record<string, unknown> }) {
      const { data, error } = await supabase
        .from('Notification')
        .update(opts.data)
        .eq('id', opts.where.id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async updateMany(opts: { where: Filter; data: Record<string, unknown> }) {
      let query = supabase
        .from('Notification')
        .update(opts.data)
      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }
      const { error } = await query
      if (error) throw error
    },
  },

  // ═══════════════════════════════════════════════════
  //  Bookmark
  // ═══════════════════════════════════════════════════

  bookmark: {
    async findFirst(opts: { where: Filter; select?: Select }) {
      let query = supabase
        .from('Bookmark')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async findMany(opts: {
      where: Filter
      select?: Select
      orderBy?: OrderBy
      take?: number
    }) {
      let query = supabase
        .from('Bookmark')
        .select(buildSelect(opts?.select))

      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      if (opts?.take) query = query.limit(opts.take)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async create(opts: { data: Record<string, unknown> }) {
      const record = { createdAt: new Date().toISOString(), ...opts.data }
      const { data, error } = await supabase
        .from('Bookmark')
        .insert(record)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async delete(opts: {
      where: { userId_postId: { userId: string; postId: string } }
    }) {
      const { userId, postId } = opts.where.userId_postId
      const { error } = await supabase
        .from('Bookmark')
        .delete()
        .eq('userId', userId)
        .eq('postId', postId)
      if (error) throw error
    },
  },

  // ═══════════════════════════════════════════════════
  //  IntelSource — 情报源管理
  // ═══════════════════════════════════════════════════

  intelSource: {
    async findMany(opts?: {
      where?: Filter
      orderBy?: OrderBy
      take?: number
      skip?: number
    }) {
      let query = supabase.from('IntelSource').select('*')

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          if (typeof val === 'object' && val !== null && 'in' in (val as any)) {
            query = query.in(col, (val as any).in)
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

    async findFirst(opts: { where: Filter }) {
      let query = supabase.from('IntelSource').select('*')
      for (const [col, val] of Object.entries(opts.where)) {
        query = query.eq(col, val)
      }
      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async create(opts: { data: Record<string, unknown> }) {
      const now = new Date().toISOString()
      const record = { id: generateId(), createdAt: now, updatedAt: now, ...opts.data }
      const { data, error } = await supabase
        .from('IntelSource')
        .insert(record)
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
        .from('IntelSource')
        .update({ ...opts.data, updatedAt: new Date().toISOString() })
        .eq('id', opts.where.id)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async delete(opts: { where: { id: string } }) {
      const { error } = await supabase
        .from('IntelSource')
        .delete()
        .eq('id', opts.where.id)
      if (error) throw error
    },

    async count(opts?: { where?: Filter }) {
      let query = supabase
        .from('IntelSource')
        .select('id', { count: 'exact', head: true })
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },
  },

  // ═══════════════════════════════════════════════════
  //  CrawlLog — 采集日志
  // ═══════════════════════════════════════════════════

  crawlLog: {
    async findMany(opts?: {
      where?: Filter
      orderBy?: OrderBy
      take?: number
      skip?: number
    }) {
      let query = supabase.from('CrawlLog').select('*')

      if (opts?.orderBy) {
        for (const [col, dir] of Object.entries(opts.orderBy)) {
          query = query.order(col, { ascending: dir === 'asc' })
        }
      }

      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }

      if (opts?.take) query = query.limit(opts.take)
      if (opts?.skip) query = query.range(opts.skip, opts.skip + (opts.take || 20) - 1)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async create(opts: { data: Record<string, unknown> }) {
      const record = { id: generateId(), createdAt: new Date().toISOString(), ...opts.data }
      const { data, error } = await supabase
        .from('CrawlLog')
        .insert(record)
        .select()
        .single()
      if (error) throw error
      return data
    },

    async count(opts?: { where?: Filter }) {
      let query = supabase
        .from('CrawlLog')
        .select('id', { count: 'exact', head: true })
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { count, error } = await query
      if (error) throw error
      return count || 0
    },
  },

  // ═══════════════════════════════════════════════════
  //  PipelineConfig — 管线键值配置
  // ═══════════════════════════════════════════════════

  pipelineConfig: {
    async findMany(opts?: { where?: Filter }) {
      let query = supabase.from('PipelineConfig').select('*')
      if (opts?.where) {
        for (const [col, val] of Object.entries(opts.where)) {
          query = query.eq(col, val)
        }
      }
      const { data, error } = await query
      if (error) throw error
      return data || []
    },

    async findFirst(opts: { where: { key: string } }) {
      const { data, error } = await supabase
        .from('PipelineConfig')
        .select('*')
        .eq('key', opts.where.key)
        .limit(1)
      if (error) throw error
      return data?.[0] || null
    },

    async upsert(opts: { key: string; value: string }) {
      const now = new Date().toISOString()
      // Check existence first, then update or insert
      const { data: existing } = await supabase
        .from('PipelineConfig')
        .select('id')
        .eq('key', opts.key)
        .limit(1)

      if (existing?.[0]) {
        const { data, error } = await supabase
          .from('PipelineConfig')
          .update({ value: opts.value, updatedAt: now })
          .eq('key', opts.key)
          .select()
          .single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('PipelineConfig')
          .insert({
            id: generateId(),
            key: opts.key,
            value: opts.value,
            updatedAt: now,
          })
          .select()
          .single()
        if (error) throw error
        return data
      }
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
