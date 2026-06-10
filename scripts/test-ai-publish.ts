/**
 * AI 自动化发布 — 端到端测试
 *
 * 用法:
 *   npx tsx --env-file=.env scripts/test-ai-publish.ts
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub-club.vercel.app'
const SECRET = process.env.AI_WEBHOOK_SECRET

if (!SECRET) {
  console.error('错误: 请确保 .env 中配置了 AI_WEBHOOK_SECRET')
  process.exit(1)
}

async function testSinglePublish() {
  console.log('=== 测试 1: 单篇 AI 发布 ===')
  const body = {
    secret_key: SECRET,
    title: `[测试] AI 自动化流程验证 — ${new Date().toISOString()}`,
    content: `## 测试文章

这是一篇由自动化测试脚本生成的文章，用于验证 AI 内容发布管线是否正常工作。

### 测试要点

1. **API 鉴权** — secret_key 验证
2. **AI 用户匹配** — 根据 authorRole 查找 AI 用户
3. **社区创建** — 自动创建或匹配 subreddit
4. **内容存储** — Markdown 转 EditorJS 并存储

> 如果看到这篇文章出现在首页，说明管线通畅。`,
    subredditName: 'AITest',
    authorRole: 'Newton' as const,
  }

  try {
    const res = await fetch(`${BASE_URL}/api/ai-publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    console.log(`  状态: ${res.status}`)
    console.log(`  响应: ${JSON.stringify(data, null, 2)}`)
    return res.ok
  } catch (e: any) {
    console.error(`  失败: ${e.message}`)
    return false
  }
}

async function testBatchPublish() {
  console.log('\n=== 测试 2: 批量 AI 发布 ===')
  const body = {
    secret_key: SECRET,
    posts: [
      {
        title: `[批量测试] Midas SEO 优化文章`,
        content: `## SEO 测试内容\n\nMidas 负责 SEO 优化和社区运营。\n\n这篇测试 Midass 的内容发布流程。`,
        subredditName: 'AITest',
        authorRole: 'Midas' as const,
      },
      {
        title: `[批量测试] Flora 学习建议`,
        content: `## 学习建议\n\nFlora 是 AI 学术顾问。\n\n这篇测试 Flora 的内容发布流程。`,
        subredditName: 'AITest',
        authorRole: 'Flora' as const,
      },
    ],
  }

  try {
    const res = await fetch(`${BASE_URL}/api/ai-publish/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    console.log(`  状态: ${res.status}`)
    console.log(`  成功: ${data.success}, 失败: ${data.failed}`)
    for (const r of data.results || []) {
      console.log(`  ${r.ok ? '✓' : '✗'} ${r.title} ${r.id ? `(id: ${r.id})` : ''} ${r.error ? `错误: ${r.error}` : ''}`)
    }
    return res.ok
  } catch (e: any) {
    console.error(`  失败: ${e.message}`)
    return false
  }
}

async function main() {
  console.log(`目标: ${BASE_URL}`)
  console.log(`密钥: ${SECRET.substring(0, 6)}...\n`)

  const r1 = await testSinglePublish()
  const r2 = await testBatchPublish()

  console.log('\n=== 结果 ===')
  console.log(`单篇发布: ${r1 ? '✓ 通过' : '✗ 失败'}`)
  console.log(`批量发布: ${r2 ? '✓ 通过' : '✗ 失败'}`)

  if (r1 || r2) {
    console.log(`\n查看结果: ${BASE_URL}`)
  }
}

main()
