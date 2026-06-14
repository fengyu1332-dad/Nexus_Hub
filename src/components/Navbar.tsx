import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { Icons } from './Icons'
import { buttonVariants } from './ui/Button'
import { UserAccountNav } from './UserAccountNav'
import SearchBar from './SearchBar'
import { LanguageSwitcher } from './LanguageSwitcher'
import NotificationBell from './NotificationBell'
import { getDictionary } from '@/i18n'

const Navbar = async () => {
  let session = null
  try {
    session = await getServerSession(authOptions)
  } catch {
    // getServerSession may fail during SSR on Vercel —
    // fall through with null session (shows Sign In link)
  }
  const dict = getDictionary()

  return (
    <div className='fixed top-0 inset-x-0 h-fit bg-zinc-100 border-b border-zinc-300 z-[10] py-2'>
      <div className='container max-w-7xl h-full mx-auto flex items-center justify-between gap-2 px-2 sm:px-6'>
        {/* logo */}
        <Link href='/' className='flex gap-2 items-center flex-shrink-0'>
          <Icons.logo className='h-7 w-7 sm:h-8 sm:w-8' />
          <p className='hidden text-zinc-700 text-sm font-medium md:block'>
            {dict.navbar.logoText}
          </p>
        </Link>

        {/* search bar — flex-1 to fill space, min-w-0 to allow shrinking */}
        <div className='flex-1 min-w-0 max-w-lg'>
          <SearchBar />
        </div>

        {/* actions */}
        <div className='flex items-center gap-1 sm:gap-2 flex-shrink-0'>
          <LanguageSwitcher />
          <NotificationBell />
          {session?.user ? (
            <UserAccountNav user={session.user} />
          ) : (
            <Link href='/sign-in' className={buttonVariants({ size: 'sm', className: 'text-xs px-2.5 py-1 sm:text-sm sm:px-4 sm:py-2' })}>
              {dict.navbar.signIn}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default Navbar
