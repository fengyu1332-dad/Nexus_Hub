import { getAuthSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/i18n'
import { DraftsList } from '@/components/DraftsList'
import Link from 'next/link'

export default async function DraftsPage() {
  const session = await getAuthSession()
  if (!session?.user) redirect('/sign-in')

  const dict = getDictionary()
  const d = dict.editor

  return (
    <div className='max-w-2xl mx-auto py-12 px-4'>
      <div className='flex items-center justify-between mb-8'>
        <h1 className='text-2xl font-bold text-zinc-900'>{d.myDrafts}</h1>
        <Link href='/' className='text-sm text-zinc-500 hover:text-zinc-700'>
          {dict.user.backHome}
        </Link>
      </div>
      <DraftsList />
    </div>
  )
}
