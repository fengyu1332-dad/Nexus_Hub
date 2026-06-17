import { getDictionary } from '@/i18n'
import { Icons } from '@/components/Icons'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const dict = getDictionary()
  const d = dict.auth

  return (
    <div className='container mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
      <div className='flex flex-col space-y-2 text-center'>
        <Icons.logo className='mx-auto h-6 w-6' />
        <h1 className='text-2xl font-semibold tracking-tight'>{d.forgotPassword}</h1>
        <p className='text-sm text-muted-foreground'>{d.resetEmailDesc}</p>
      </div>
      <ForgotPasswordForm
        labels={{
          emailPlaceholder: d.emailPlaceholder,
          sendResetLink: d.sendResetLink,
          resetEmailSent: d.resetEmailSent,
        }}
      />
      <p className='px-8 text-center text-sm text-muted-foreground'>
        <Link href='/sign-in' className='hover:text-brand text-sm underline underline-offset-4'>
          {d.signIn}
        </Link>
      </p>
    </div>
  )
}
