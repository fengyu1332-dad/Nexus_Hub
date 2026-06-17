import { getAdminSession } from '@/lib/auth-admin'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/i18n'
import { AdminReportsTable } from '@/components/admin/AdminReportsTable'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const d = dict.admin

  let reports: any[] = []
  let total = 0

  try {
    const rawReports = (await db.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })) as any[]

    // Batch resolve reporter usernames
    const reporterIds = Array.from(new Set(rawReports.map((r: any) => r.reporterId))) as string[]
    const reporterMap = new Map<string, string>()
    for (const rid of reporterIds) {
      const u = await db.user.findFirst({
        where: { id: rid },
        select: { username: true },
      })
      if (u) reporterMap.set(rid, (u as any).username || 'unknown')
    }

    reports = rawReports.map((r: any) => ({
      ...r,
      reporterUsername: reporterMap.get(r.reporterId) || 'unknown',
    }))
    total = reports.length
  } catch {
    // DB may not have Report table yet
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-zinc-900'>{d.reports}</h1>
      </div>
      <div className='rounded-lg border bg-white p-6'>
        <AdminReportsTable initialReports={reports} initialTotal={total} />
      </div>
    </div>
  )
}
