/**
 * 种子脚本：添加权威升学信息源
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

const SOURCES = [
  {
    label: 'WHED (World Higher Education Database)',
    url: 'https://www.whed.net/',
    category: 'accreditation',
    note: 'UNESCO/IAU 合作维护，收录全球近22,000所认证高校 — 查教育资质的终极源头',
  },
  {
    label: 'Common App (Explore Colleges)',
    url: 'https://www.commonapp.org/explore/',
    category: 'admissions',
    note: '全球1000+高校本科申请核心数据库，截止日期、标化政策更新及时',
  },
  {
    label: 'UCAS (Course Search)',
    url: 'https://www.ucas.com/explore/search/courses',
    category: 'admissions',
    note: '英国全国统一大学申请系统，各专业对A-Level/IB/AP的具体分数要求',
  },
  {
    label: 'StudyPortals — BachelorsPortal',
    url: 'https://www.bachelorsportal.com/',
    category: 'programs',
    note: '全球最大留学项目搜索引擎之一，可按预算/雅思/托福/授课语言反向筛选',
  },
  {
    label: 'StudyPortals — MastersPortal',
    url: 'https://www.mastersportal.com/',
    category: 'programs',
    note: '研究生版 StudyPortals，覆盖超10万学位项目',
  },
  {
    label: 'ApplyBoard',
    url: 'https://www.applyboard.com/',
    category: 'admissions',
    note: '全球留学申请聚合平台，国际生申请流程、签证政策变化总结直观',
  },
  {
    label: 'College Board International',
    url: 'https://international.collegeboard.org/',
    category: 'exams',
    note: '全球60+国家4000+大学接受SAT/AP成绩的官方源头，学分转换政策',
  },
  {
    label: 'NACAC (美国大学招生咨询协会)',
    url: 'https://www.nacacnet.org/',
    category: 'rankings',
    note: '升学指导行业权威智库，《国际大学招生指南》及招录数据报告',
  },
  {
    label: 'QS Top Universities',
    url: 'https://www.topuniversities.com/',
    category: 'rankings',
    note: '详细国际生比例、师生比数据，直接导向各大学官方国际生申请页面',
  },
]

async function main() {
  console.log('Seeding authority intel sources...\n')

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
        crawlInterval: 120,
        isActive: true,
      },
    })

    console.log(`  ADD  ${src.label}`)
    console.log(`       → ${src.url}`)
    added++
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped, ${SOURCES.length} total`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  prisma.$disconnect().finally(() => process.exit(1))
})
