'use client'

import { cn } from '@/lib/utils'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icons } from './Icons'
import { useDict } from '@/components/I18nProvider'

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  showCredentials?: boolean
}

const UserAuthForm = ({ className, showCredentials, ...props }: UserAuthFormProps) => {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const dict = useDict()

  const loginWithProvider = async (provider: string) => {
    setIsLoading(provider)
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
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/',
      })
      if (result?.error) {
        setError(dict.toast.invalidCredentials || 'Invalid email or password')
      } else if (result?.ok) {
        window.location.href = '/'
      }
    } catch {
      setError(dict.toast.googleLoginError)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className={cn('flex flex-col gap-4', className)} {...props}>
      {/* OAuth providers */}
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
            {error && <p className='text-sm text-red-500'>{error}</p>}
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
