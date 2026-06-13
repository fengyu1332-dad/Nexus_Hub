import { PrismaClient } from '@prisma/client'

const p = new PrismaClient({ log: ['error'] })

async function main() {
  const labels = [
    'Nature — RSS',
    'Science Magazine — RSS',
    'ScienceDaily — RSS',
    'MIT Technology Review — RSS',
  ]

  for (const label of labels) {
    const r = await p.intelSource.updateMany({
      where: { label },
      data: { isActive: false },
    })
    console.log(`DISABLED: ${label} (${r.count} rows)`)
  }

  const active = await p.intelSource.count({ where: { isActive: true } })
  const rss = await p.intelSource.count({ where: { isActive: true, type: 'rss' } })
  console.log(`\nActive total: ${active} | Active RSS: ${rss}`)
  await p.$disconnect()
}
main().catch((e) => { console.error(e); p.$disconnect() })
