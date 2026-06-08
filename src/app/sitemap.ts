/**
 * Nexus Hub — 动态 Sitemap 生成
 *
 * 覆盖:
 *   - 首页 (/)
 *   - 所有板块 (/r/[slug])
 *   - 所有帖子 (/r/[slug]/post/[postId])
 *
 * 提交地址:
 *   Google Search Console → 添加 sitemap → https://你的域名/sitemap.xml
 *   Bing Webmaster Tools → Sitemaps → https://你的域名/sitemap.xml
 */

import { db } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub.vercel.app'

export default async function sitemap() {
  // ── 静态路由 ──────────────────────────────────────────
  const staticRoutes = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 1.0,
    },
  ]

  // ── 板块路由 ──────────────────────────────────────────
  let subredditRoutes: any[] = []
  let postRoutes: any[] = []
  try {
    const subreddits = await db.subreddit.findMany({
      select: { name: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    subredditRoutes = subreddits.map((s) => ({
      url: `${BASE_URL}/r/${s.name}`,
      lastModified: s.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

    const posts = await db.post.findMany({
      select: {
        id: true,
        updatedAt: true,
        subreddit: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })
    postRoutes = posts.map((p) => ({
      url: `${BASE_URL}/r/${p.subreddit.name}/post/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  } catch {
    // DATABASE_URL 未配置时回退为仅首页 sitemap
    console.warn('[sitemap] Database unavailable, generating minimal sitemap')
  }

  return [...staticRoutes, ...subredditRoutes, ...postRoutes]
}
