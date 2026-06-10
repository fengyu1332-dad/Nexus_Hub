/**
 * 删除 AI 测试帖子（通过 Supabase REST API）
 *
 * 用法:
 *   npx tsx --env-file=.env scripts/delete-test-post.ts c_mq7pt929_2_qvp8h1
 */

import { createClient } from '@supabase/supabase-js'

const postId = process.argv[2] || 'c_mq7pt929_2_qvp8h1'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('错误: .env 缺少 Supabase 配置')
  process.exit(1)
}

async function main() {
  const supabase = createClient(supabaseUrl!, supabaseKey!)

  // 1. 先检查帖子是否存在
  const { data: post, error: findError } = await supabase
    .from('Post')
    .select('id, title')
    .eq('id', postId)
    .single()

  if (findError) {
    console.error('查找帖子失败:', findError.message)
    process.exit(1)
  }

  console.log(`找到帖子: ${(post as any).title}`)

  // 2. 先删关联的 votes/comments（如果有）
  await supabase.from('Vote').delete().eq('postId', postId)
  await supabase.from('Comment').delete().eq('postId', postId)
  await supabase.from('Bookmark').delete().eq('postId', postId)

  // 3. 删除帖子本身
  const { error: deleteError } = await supabase
    .from('Post')
    .delete()
    .eq('id', postId)

  if (deleteError) {
    console.error('删除失败:', deleteError.message)
    process.exit(1)
  }

  console.log(`✓ 已删除帖子: ${postId}`)
}

main()
