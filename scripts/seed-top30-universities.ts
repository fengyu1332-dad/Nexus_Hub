/**
 * 种子脚本：将 QS 2025 排名前 30 大学官网添加为情报源
 * 用法：npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-top30-universities.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

const QS_TOP30 = [
  { rank: 1,  name: 'MIT',                       url: 'https://news.mit.edu/' },
  { rank: 2,  name: 'Imperial College London',   url: 'https://www.imperial.ac.uk/news/' },
  { rank: 3,  name: 'University of Oxford',      url: 'https://www.ox.ac.uk/news/' },
  { rank: 4,  name: 'Harvard University',        url: 'https://news.harvard.edu/gazette/' },
  { rank: 5,  name: 'University of Cambridge',   url: 'https://www.cam.ac.uk/news' },
  { rank: 6,  name: 'Stanford University',       url: 'https://news.stanford.edu/' },
  { rank: 7,  name: 'ETH Zurich',                url: 'https://ethz.ch/en/news-and-events.html' },
  { rank: 8,  name: 'National University of Singapore', url: 'https://news.nus.edu.sg/' },
  { rank: 9,  name: 'UCL',                       url: 'https://www.ucl.ac.uk/news/' },
  { rank: 10, name: 'Caltech',                   url: 'https://www.caltech.edu/about/news' },
  { rank: 11, name: 'University of Pennsylvania', url: 'https://penntoday.upenn.edu/' },
  { rank: 12, name: 'UC Berkeley',               url: 'https://news.berkeley.edu/' },
  { rank: 13, name: 'University of Melbourne',   url: 'https://www.unimelb.edu.au/newsroom' },
  { rank: 14, name: 'Peking University',         url: 'https://news.pku.edu.cn/' },
  { rank: 15, name: 'Nanyang Technological University', url: 'https://www.ntu.edu.sg/news' },
  { rank: 16, name: 'Cornell University',        url: 'https://news.cornell.edu/' },
  { rank: 17, name: 'University of Sydney',      url: 'https://www.sydney.edu.au/news/' },
  { rank: 18, name: 'UNSW Sydney',               url: 'https://newsroom.unsw.edu.au/' },
  { rank: 19, name: 'Tsinghua University',       url: 'https://www.tsinghua.edu.cn/en/news.htm' },
  { rank: 20, name: 'University of Chicago',     url: 'https://news.uchicago.edu/' },
  { rank: 21, name: 'Princeton University',      url: 'https://www.princeton.edu/news' },
  { rank: 22, name: 'Yale University',           url: 'https://news.yale.edu/' },
  { rank: 23, name: 'University of Toronto',     url: 'https://www.utoronto.ca/news' },
  { rank: 24, name: 'EPFL',                      url: 'https://actu.epfl.ch/' },
  { rank: 25, name: 'University of Edinburgh',   url: 'https://www.ed.ac.uk/news' },
  { rank: 26, name: 'Technical University of Munich', url: 'https://www.tum.de/en/news-and-events' },
  { rank: 27, name: 'McGill University',         url: 'https://www.mcgill.ca/newsroom/' },
  { rank: 28, name: 'University of British Columbia', url: 'https://news.ubc.ca/' },
  { rank: 29, name: 'University of Manchester',  url: 'https://www.manchester.ac.uk/discover/news/' },
  { rank: 30, name: 'University of Hong Kong',   url: 'https://www.hku.hk/press/' },
]

async function main() {
  console.log('Seeding QS Top 30 universities as intel sources...\n')

  let added = 0
  let skipped = 0

  for (const uni of QS_TOP30) {
    // Check for existing source with same URL
    const existing = await prisma.intelSource.findFirst({
      where: { url: uni.url },
      select: { id: true, label: true },
    })

    if (existing) {
      console.log(`  SKIP #${uni.rank} ${uni.name} — already exists (${existing.label})`)
      skipped++
      continue
    }

    await prisma.intelSource.create({
      data: {
        label: `${uni.name} News`,
        url: uni.url,
        type: 'webpage',
        category: 'rankings',
        priority: 'high',
        crawlInterval: 120,
        isActive: true,
      },
    })

    console.log(`  ADD  #${uni.rank} ${uni.name} → ${uni.url}`)
    added++
  }

  console.log(`\nDone: ${added} added, ${skipped} skipped, ${QS_TOP30.length} total`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  prisma.$disconnect().finally(() => process.exit(1))
})
