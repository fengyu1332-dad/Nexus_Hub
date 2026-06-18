'use client'

import { cn } from '@/lib/utils'
import { signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Icons } from './Icons'
import { useDict } from '@/components/I18nProvider'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  showCredentials?: boolean
}

const UserAuthForm = ({ className, showCredentials, ...props }: UserAuthFormProps) => {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const dict = useDict()

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const err = p.get('error')
    if (err === 'google') setError(dict.toast.googleLoginError)
    else if (err === 'github') setError('GitHub 登录失败，请重试')
    else if (err === 'CredentialsSignin') setError(dict.toast.invalidCredentials)
  }, [dict])

  const loginWithProvider = async (provider: string) => {
    setIsLoading(provider)
    trackEvent(AnalyticsEvent.SIGN_IN, { provider })
    try {
      await signIn(provider, { callbackUrl: '/' })
    } catch {
      setError(dict.toast.googleLoginError)
    } finally {
      setIsLoading(null)
    }
  }

  const loginWithCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading('credentials')
    trackEvent(AnalyticsEvent.SIGN_IN, { provider: 'credentials' })
    await signIn('credentials', {
      email,
      password,
      callbackUrl: '/',
    })
  }

  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      {error && (
        <p className='text-sm text-red-500 text-center bg-red-50 rounded-lg py-2 px-3'>
          {error}
        </p>
      )}

      <Button
        isLoading={isLoading === 'google'}
        type='button'
        size='sm'
        className='w-full'
        onClick={() => loginWithProvider('google')}
        disabled={!!isLoading}>
        {isLoading !== 'google' && <Icons.google className='h-4 w-4 mr-2' />}
        {dict.auth.google}
      </Button>

      <Button
        isLoading={isLoading === 'github'}
        type='button'
        size='sm'
        className='w-full'
        onClick={() => loginWithProvider('github')}
        disabled={!!isLoading}>
        {isLoading !== 'github' && <Icons.github className='h-4 w-4 mr-2' />}
        {dict.auth.github}
      </Button>

      <Button
        isLoading={isLoading === 'wechat'}
        type='button'
        size='sm'
        className='w-full'
        onClick={() => loginWithProvider('wechat')}
        disabled={!!isLoading}>
        {isLoading !== 'wechat' && <Icons.wechat className='h-4 w-4 mr-2' />}
        {dict.auth.wechat}
      </Button>

      {showCredentials && (
        <>
          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background px-2 text-muted-foreground'>
                {dict.auth.orEmail}
              </span>
            </div>
          </div>

          <form onSubmit={loginWithCredentials} className='flex flex-col gap-3'>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={dict.auth.emailPlaceholder}
              className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
              required
            />
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={dict.auth.passwordPlaceholder}
              className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
              required
            />
            <div className='flex justify-end'>
              <Link
                href='/forgot-password'
                className='text-rose-500 hover:text-rose-600 text-xs font-medium'>
                {dict.auth.forgotPassword}
              </Link>
            </div>
            <Button
              isLoading={isLoading === 'credentials'}
              type='submit'
              size='sm'
              className='w-full'
              disabled={!!isLoading}>
              {dict.auth.signIn}
            </Button>
          </form>
        </>
      )}
    </div>
  )
}

export default UserAuthForm
