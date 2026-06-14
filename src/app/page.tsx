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
  const sort = (searchParams.sort as string) || 'hot'

  return (
    <>
      <h1 className='font-bold text-2xl sm:text-3xl md:text-4xl px-1'>{dict.home.nexusHub}</h1>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-y-4 md:gap-x-4 py-4 sm:py-6'>
        <div className='col-span-2 space-y-4'>
          <div className='flex items-center justify-between gap-2 flex-wrap px-1'>
            <Suspense fallback={null}>
              <SortSelector />
            </Suspense>
            <Link
              href='/r/student-life/submit'
              className={buttonVariants({ size: 'sm', className: 'gap-1.5 text-xs sm:text-sm' })}>
              <Pencil className='h-3.5 w-3.5 sm:h-4 sm:w-4' />
              {dict.user.createPost}
            </Link>
          </div>
          <GeneralFeed sort={sort} />
        </div>

        <div className='order-first md:order-last space-y-4 px-1 sm:px-0'>
          <BoardSidebar />
          <NewsletterSignup />
        </div>
      </div>
    </>
  )
}
