import { getAdminSession } from '@/lib/auth-admin'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AdminStatsSkeleton } from '@/components/admin/AdminStatsSkeleton'
import { AdminStatsLoader } from '@/components/admin/AdminStatsLoader'
import { getDictionary } from '@/i18n'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.dashboard}</h1>
      <Suspense fallback={<AdminStatsSkeleton />}>
        <AdminStatsLoader />
      </Suspense>
    </div>
  )
}
