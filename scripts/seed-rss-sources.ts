/**
 * 种子脚本：添加 RSS 情报源
 * RSS 优先于 webpage — 结构化、增量更新、无需浏览器渲染
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

const RSS_SOURCES = [
  // ═══════════════════════════════════════════════════════
  //  1. 顶尖大学官方 RSS
  // ═══════════════════════════════════════════════════════
  {
    label: 'MIT News — RSS',
    url: 'https://news.mit.edu/rss/feed',
    category: 'rankings',
    note: 'MIT 官方新闻 RSS，科研突破、招生动态、校园政策一手发布',
    crawlInterval: 60,
    priority: 'high' as const,
  },
  {
    label: 'Cambridge University News — RSS',
    url: 'https://www.cam.ac.uk/news/feed',
    category: 'rankings',
    note: '剑桥大学官方新闻 RSS，涵盖招生、科研、学院动态',
    crawlInterval: 60,
    priority: 'high' as const,
  },
  {
    label: 'UBC News — RSS',
    url: 'https://news.ubc.ca/feed/',
    category: 'rankings',
    note: '不列颠哥伦比亚大学官方新闻 RSS，国际生比例高，招生信息丰富',
    crawlInterval: 60,
    priority: 'high' as const,
  },

  // ═══════════════════════════════════════════════════════
  //  2. 教育行业权威媒体 RSS
  // ═══════════════════════════════════════════════════════
  {
    label: 'Inside Higher Ed — RSS',
    url: 'https://www.insidehighered.com/rss.xml',
    category: 'general',
    note: '美国高等教育最权威的独立媒体，招录趋势、学术政策、大学治理深度分析',
    crawlInterval: 30,
    priority: 'high' as const,
  },
  {
    label: 'The Hechinger Report — RSS',
    url: 'https://hechingerreport.org/feed/',
    category: 'general',
    note: '教育公平与创新深度报道，美国高等教育政策变化、录取改革第一手分析',
    crawlInterval: 60,
    priority: 'high' as const,
  },
  {
    label: 'ICEF Monitor — RSS',
    url: 'https://monitor.icef.com/feed/',
    category: 'general',
    note: '国际教育产业权威媒体，留学市场趋势、签证政策、招生策略全球视角',
    crawlInterval: 30,
    priority: 'high' as const,
  },
  {
    label: 'The PIE News — RSS',
    url: 'https://thepienews.com/feed/',
    category: 'general',
    note: 'Professionals in International Education — 国际教育行业新闻，留学政策/市场动态',
    crawlInterval: 30,
    priority: 'high' as const,
  },

  // ═══════════════════════════════════════════════════════
  //  3. 科技与学术前沿 RSS（大学排名/科研影响力相关）
  // ═══════════════════════════════════════════════════════
  {
    label: 'Nature — RSS',
    url: 'https://www.nature.com/nature.rss',
    category: 'rankings',
    note: '全球最顶级科学期刊 RSS，高校科研产出、学术突破直接影响QS/THE排名指标',
    crawlInterval: 60,
    priority: 'medium' as const,
  },
  {
    label: 'Science Magazine — RSS',
    url: 'https://www.science.org/rss/news_current.xml',
    category: 'rankings',
    note: 'Science 期刊新闻 RSS，全球科研动态与高校学术影响力',
    crawlInterval: 60,
    priority: 'medium' as const,
  },
  {
    label: 'ScienceDaily — RSS',
    url: 'https://www.sciencedaily.com/rss/top.xml',
    category: 'rankings',
    note: '科研新闻聚合器，每日汇总全球大学最新研究发现，覆盖面极广',
    crawlInterval: 60,
    priority: 'medium' as const,
  },
  {
    label: 'MIT Technology Review — RSS',
    url: 'https://www.technologyreview.com/feed/',
    category: 'rankings',
    note: 'MIT 科技评论 RSS，新兴技术趋势与高校创新生态',
    crawlInterval: 60,
    priority: 'medium' as const,
  },
]

async function main() {
  console.log('Seeding RSS intel sources...\n')
  console.log(`  Total: ${RSS_SOURCES.length} RSS feeds`)
  console.log(`  🔴 high priority:   ${RSS_SOURCES.filter(s => s.priority === 'high').length}`)
  console.log(`  🟡 medium priority: ${RSS_SOURCES.filter(s => s.priority === 'medium').length}\n`)

  let added = 0
  let skipped = 0

  for (const src of RSS_SOURCES) {
    const existing = await prisma.intelSource.findFirst({
      where: { url: { startsWith: src.url } },
      select: { id: true, label: true },
    })

    if (existing) {
      console.log(`  SKIP ${src.label} — already exists (${existing.label})`)
      skipped++
      continue
    }

    await prisma.intelSource.create({
      data: {
        label: src.label,
        url: src.url,
        type: 'rss',
        category: src.category,
        priority: src.priority,
        crawlInterval: src.crawlInterval,
        isActive: true,
      },
    })

    const prio = src.priority === 'high' ? '🔴' : '🟡'
    console.log(`  ADD  ${prio} [${src.category}] ${src.label}`)
    added++
  }

  // Summary
  const total = await prisma.intelSource.count()
  const rssCount = await prisma.intelSource.count({ where: { type: 'rss' } })
  const webCount = await prisma.intelSource.count({ where: { type: 'webpage' } })

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Done: ${added} added, ${skipped} skipped, ${RSS_SOURCES.length} total`)
  console.log(`\nDatabase totals: ${total} sources (${rssCount} RSS + ${webCount} webpage)`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  prisma.$disconnect().finally(() => process.exit(1))
})
