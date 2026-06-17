import { Icons } from '@/components/Icons'
import UserAuthForm from '@/components/UserAuthForm'
import { getDictionary } from '@/i18n'
import Link from 'next/link'

const SignIn = () => {
  const dict = getDictionary()

  return (
    <div className='container mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
      <div className='flex flex-col space-y-2 text-center'>
        <Icons.logo className='mx-auto h-6 w-6' />
        <h1 className='text-2xl font-semibold tracking-tight'>{dict.auth.welcomeBack}</h1>
        <p className='text-sm max-w-xs mx-auto'>
          {dict.auth.termsConsent}
        </p>
      </div>
      <UserAuthForm showCredentials />
      <p className='px-8 text-center text-sm text-muted-foreground'>
        <Link
          href='/forgot-password'
          className='hover:text-brand text-sm underline underline-offset-4'>
          {dict.auth.forgotPassword}
        </Link>
      </p>
      <p className='px-8 text-center text-sm text-muted-foreground'>
        {dict.auth.newToSite}{' '}
        <Link
          href='/sign-up'
          className='hover:text-brand text-sm underline underline-offset-4'>
          {dict.auth.signUp}
        </Link>
      </p>
    </div>
  )
}

export default SignIn
