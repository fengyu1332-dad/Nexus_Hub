import { getAdminSession } from '@/lib/auth-admin'
import { redirect } from 'next/navigation'
import { NewsletterManager } from '@/components/admin/NewsletterManager'

export default async function AdminNewsletterPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold text-zinc-900'>Newsletter 管理</h1>
      <NewsletterManager />
    </div>
  )
}
