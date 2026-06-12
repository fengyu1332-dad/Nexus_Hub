import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/auth-admin'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { getDictionary } from '@/i18n'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const labels = {
    dashboard: dict.admin.dashboard,
    users: dict.admin.users,
    posts: dict.admin.posts,
    aiAgents: dict.admin.aiAgents,
    aiDashboard: dict.admin.aiDashboard,
    intelSources: dict.admin.intelSources,
    systemStatus: dict.admin.systemStatus,
    backToSite: dict.admin.backToSite,
  }

  return (
    <div className='flex min-h-[calc(100vh-3.5rem)] pt-14'>
      <AdminSidebar labels={labels} />
      <main className='flex-1 p-8 bg-white'>{children}</main>
    </div>
  )
}
