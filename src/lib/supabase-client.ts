/**
 * Nexus Hub — Supabase REST API 客户端
 *
 * 使用 Supabase JS SDK + REST API 查询数据库
 * 绕过 Vercel → Supabase 直连的网络限制
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://gqglwmchhjxzoogixbar.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxZ2x3bWNoaGp4em9vZ2l4YmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3ODQ5NDIsImV4cCI6MjA5NjM2MDk0Mn0.gpsrHeT7jb9ptGcYk5MB47WVd4gvjrOR82POJTT-OYs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
