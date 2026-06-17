import { getDictionary } from '@/i18n'
import { Icons } from '@/components/Icons'
import { ResetPasswordForm } from './ResetPasswordForm'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const dict = getDictionary()
  const d = dict.auth

  return (
    <div className='container mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
      <div className='flex flex-col space-y-2 text-center'>
        <Icons.logo className='mx-auto h-6 w-6' />
        <h1 className='text-2xl font-semibold tracking-tight'>{d.resetPassword}</h1>
        <p className='text-sm text-muted-foreground'>{d.enterNewPassword}</p>
      </div>
      <ResetPasswordForm
        labels={{
          passwordPlaceholder: d.passwordPlaceholder,
          resetPassword: d.resetPassword,
          invalidOrExpiredToken: d.invalidOrExpiredToken,
          passwordResetSuccess: d.passwordResetSuccess,
          signIn: d.signIn,
        }}
      />
    </div>
  )
}
