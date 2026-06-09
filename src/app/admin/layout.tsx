import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/auth-admin'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()
  if (!session) redirect('/')

  return (
    <div className='flex min-h-[calc(100vh-3.5rem)] pt-14'>
      <AdminSidebar />
      <main className='flex-1 p-8 bg-white'>{children}</main>
    </div>
  )
}
