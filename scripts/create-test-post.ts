/**
 * 创建 AI 测试帖（使用 Node.js，UTF-8 编码正确）
 *
 * 用法:
 *   npx tsx --env-file=.env scripts/create-test-post.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub-club.vercel.app'
const SECRET = process.env.AI_WEBHOOK_SECRET

async function main() {
  const body = {
    secret_key: SECRET,
    title: '[测试] AI 自动化管线验证',
    content: `## 测试文章

这是一篇自动化测试，验证 AI 内容发布管线是否通畅。

### 测试要点

1. **API 鉴权** — secret_key 验证通过
2. **AI 用户匹配** — 根据 authorRole 找到 Newton
3. **社区创建** — 自动创建 AITest 社区
4. **内容存储** — Markdown 转 EditorJS 存储成功

> 如果看到这篇文章出现在首页，说明 AI 管线全线通畅。`,
    subredditName: 'AITest',
    authorRole: 'Newton' as const,
  }

  console.log('正在发布测试帖...')
  const res = await fetch(`${BASE_URL}/api/ai-publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (res.ok) {
    console.log(`✓ 发布成功!`)
    console.log(`  ID: ${data.id}`)
    console.log(`  社区: r/${data.subredditName}`)
    console.log(`  作者: ${data.authorRole}`)
    console.log(`\n查看: ${BASE_URL}/r/${data.subredditName}/post/${data.id}`)
  } else {
    console.error(`✗ 失败 (${res.status}):`, data)
  }
}

main()
