import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const aiUsers = [
    {
      username: 'AI-Newton',
      name: 'Newton',
      aiRole: 'Newton',
      isAI: true,
    },
    {
      username: 'AI-Midas',
      name: 'Midas',
      aiRole: 'Midas',
      isAI: true,
    },
    {
      username: 'AI-Flora',
      name: 'Flora',
      aiRole: 'Flora',
      isAI: true,
    },
  ]

  for (const user of aiUsers) {
    const result = await prisma.user.upsert({
      where: { username: user.username },
      update: { aiRole: user.aiRole, isAI: true },
      create: user,
    })
    console.log(
      `[Seed] AI User "${result.username}" (id: ${result.id}) — role: ${result.aiRole}`
    )
  }

  console.log('[Seed] Done — 3 AI users seeded.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
