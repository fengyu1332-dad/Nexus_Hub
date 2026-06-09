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
  const session = await getServerSession(authOptions)
  const dict = getDictionary()

  return (
    <div className='fixed top-0 inset-x-0 h-fit bg-zinc-100 border-b border-zinc-300 z-[10] py-2'>
      <div className='container max-w-7xl h-full mx-auto flex items-center justify-between gap-2'>
        {/* logo */}
        <Link href='/' className='flex gap-2 items-center'>
          <Icons.logo className='h-8 w-8 sm:h-6 sm:w-6' />
          <p className='hidden text-zinc-700 text-sm font-medium md:block'>
            {dict.navbar.logoText}
          </p>
        </Link>

        {/* search bar */}
        <SearchBar />

        {/* actions */}
        <div className='flex items-center gap-2'>
          <LanguageSwitcher />
          <NotificationBell />
          {session?.user ? (
            <UserAccountNav user={session.user} />
          ) : (
            <Link href='/sign-in' className={buttonVariants()}>
              {dict.navbar.signIn}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default Navbar
