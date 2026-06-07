/**
 * Nexus Hub — robots.txt
 *
 * 规则:
 *   - 允许所有爬虫索引公开内容（帖子、板块、首页）
 *   - 禁止爬取认证页面和管理后台
 *   - 指向动态生成的 Sitemap
 */

import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/sign-in',
          '/sign-up',
          '/settings',
          '/@authModal/',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/', // 默认禁止 AI 爬虫（可按需放开）
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
