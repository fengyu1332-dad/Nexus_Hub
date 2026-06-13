/**
 * 种子脚本：添加中文留学信息源
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

const SOURCES = [
  // ── 1. 中国官方认证中心 ──
  {
    label: '中国教育部留学服务中心 (中国留学网)',
    url: 'https://www.cscse.edu.cn/',
    category: 'accreditation',
    note: '判断海外大学学历含金量的官方底线 — 归国留学生学历认证，核实目标院校是否在官方认可名录',
  },
  {
    label: '教育部涉外监管信息网',
    url: 'https://jsj.moe.gov.cn/',
    category: 'accreditation',
    note: '官方认可海外院校名单 + 留学预警，通报涉嫌违规的海外合作办学项目',
  },

  // ── 2. 硬核留学生社区与数据池 ──
  {
    label: '一亩三分地 (1Point3Acres)',
    url: 'https://www.1point3acres.com/bbs/',
    category: 'community',
    note: '北美/全球 STEM 与商科申请数据重镇 — GPA/标化/竞赛/科研背景真实汇报，精准定位竞争力',
  },
  {
    label: '寄托天下 (Gter)',
    url: 'https://bbs.gter.net/',
    category: 'community',
    note: '综合类留学社区，英国/香港/新加坡/欧洲申请讨论活跃，Offer雨板块 + 面经汇总',
  },

  // ── 3. 经验分享平台 ──
  {
    label: '小红书 — 留学经验',
    url: 'https://www.xiaohongshu.com/explore',
    category: 'experience',
    note: '长尾关键词检索微观体验：面试真题、竞赛含金量、就读课业压力 — 官方数据外的重要补充',
  },

  // ── 4. 商业机构中文院校库 ──
  {
    label: '指南者留学 — 院校库',
    url: 'https://www.compassedu.com/',
    category: 'programs',
    note: '中文本土化院校库，可按作品集/跨专业/最低语言要求等标签快速筛选项目',
  },
  {
    label: '新东方前途出国 — 院校库',
    url: 'https://liuxue.xdf.cn/',
    category: 'programs',
    note: '头部留学机构中文院校库，适合申请初期头脑风暴和海选',
  },

  // ── 5. 新闻与政策报道 ──
  {
    label: '中国教育在线 — 国际教育频道',
    url: 'https://www.eol.cn/guoji/',
    category: 'general',
    note: '国内权威教育媒体国际频道，留学政策变化、考试动态一手报道',
  },
]

async function main() {
  console.log('Seeding Chinese education intel sources...\n')

  let added = 0
  let skipped = 0

  for (const src of SOURCES) {
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
        type: 'webpage',
        category: src.category,
        priority: 'high',
        crawlInterval: 180, // 3h — 社区和官方信息更新较慢
        isActive: true,
      },
    })

    console.log(`  ADD  [${src.category}] ${src.label}`)
    added++
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped, ${SOURCES.length} total`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  prisma.$disconnect().finally(() => process.exit(1))
})
