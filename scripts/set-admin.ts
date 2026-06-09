/**
 * 通过 Supabase REST API 将指定邮箱的用户设为管理员
 *
 * 用法:
 *   npx tsx --env-file=.env scripts/set-admin.ts
 *
 * 前提: .env 中已配置 ADMIN_EMAIL 和 Supabase 环境变量
 * 用户需先通过 Google OAuth 登录过一次（账号已存在于 User 表中）
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const adminEmail = process.env.ADMIN_EMAIL

if (!supabaseUrl || !supabaseKey) {
  console.error('错误: 请确保 .env 中配置了 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

if (!adminEmail) {
  console.error('错误: 请确保 .env 中配置了 ADMIN_EMAIL')
  process.exit(1)
}

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseKey!)

  console.log(`正在查找邮箱为 "${adminEmail}" 的用户...`)

  // 查找用户
  const { data: users, error: findError } = await supabase
    .from('User')
    .select('id, username, email, isAdmin')
    .eq('email', adminEmail)
    .limit(1)

  if (findError) {
    console.error('查询用户失败:', findError.message)
    process.exit(1)
  }

  if (!users || users.length === 0) {
    console.error(`未找到邮箱为 "${adminEmail}" 的用户。`)
    console.error('请先通过 Google OAuth 登录一次网站，系统会自动创建用户记录。')
    console.error('登录后重新运行此脚本即可。')
    process.exit(1)
  }

  const user = users[0]
  console.log(`找到用户: ${user.username} (${user.email}) — 当前 isAdmin: ${user.isAdmin}`)

  // 设为管理员
  const { error: updateError } = await supabase
    .from('User')
    .update({ isAdmin: true })
    .eq('id', user.id)

  if (updateError) {
    console.error('更新失败:', updateError.message)
    process.exit(1)
  }

  console.log(`✓ 已将 "${user.username}" 设为管理员。`)
  console.log('请重新登录（退出再登录）以使权限生效。')
}

main()
