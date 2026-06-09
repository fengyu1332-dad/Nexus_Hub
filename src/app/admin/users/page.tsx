import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { AdminUsersTable } from '@/components/admin/AdminUsersTable'
import { getDictionary } from '@/i18n'

export default async function AdminUsersPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const limit = 20

  const [users, total] = await Promise.all([
    db.user.findMany({
      select: { id: true, username: true, email: true, image: true, isAI: true, aiRole: true, isAdmin: true },
      take: limit,
      orderBy: { username: 'asc' },
    }),
    db.user.count({ where: {} }),
  ])

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{dict.admin.users}</h1>
      <AdminUsersTable
        initialUsers={(users || []) as any}
        initialTotal={total}
        initialPage={1}
        labels={{
          searchUsers: dict.admin.searchUsers,
          noUsers: dict.admin.noUsers,
          makeAdmin: dict.admin.makeAdmin,
          removeAdmin: dict.admin.removeAdmin,
        }}
      />
    </div>
  )
}
