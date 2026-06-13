import { buttonVariants } from '@/components/ui/Button'
import SortSelector from '@/components/SortSelector'
import GeneralFeed from '@/components/homepage/GeneralFeed'
import BoardSidebar from '@/components/BoardSidebar'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { getDictionary } from '@/i18n'
import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const dict = getDictionary()
  const sort = (searchParams.sort as string) || 'new'

  return (
    <>
      <h1 className='font-bold text-3xl md:text-4xl'>{dict.home.nexusHub}</h1>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-4 py-6'>
        <div className='col-span-2 space-y-4'>
          <div className='flex items-center justify-between'>
            <Suspense fallback={null}>
              <SortSelector />
            </Suspense>
            <Link
              href='/r/student-life/submit'
              className={buttonVariants({ size: 'sm', className: 'gap-1.5' })}>
              <Pencil className='h-4 w-4' />
              {dict.user.createPost}
            </Link>
          </div>
          <GeneralFeed sort={sort} />
        </div>

        <div className='order-first md:order-last space-y-4'>
          <BoardSidebar />
          <NewsletterSignup />
        </div>
      </div>
    </>
  )
}
