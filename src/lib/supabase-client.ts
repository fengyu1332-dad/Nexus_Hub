/**
 * Nexus Hub — Supabase REST API 客户端
 *
 * 使用 Supabase JS SDK + REST API 查询数据库
 * 绕过 Vercel → Supabase 直连的网络限制
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 构建时不抛错（本地可能未配置），运行时未配置会在查询时报错
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any
