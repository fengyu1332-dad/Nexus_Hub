'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useDict } from '@/components/I18nProvider'
import { Icons } from '@/components/Icons'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export function VerifyEmailClient() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const dict = useDict()

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Missing verification token.')
      return
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success')
        } else {
          setStatus('error')
          setError(data.error || 'Verification failed.')
        }
      })
      .catch(() => {
        setStatus('error')
        setError('Network error. Please try again.')
      })
  }, [token])

  return (
    <div className='container mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
      <div className='flex flex-col space-y-2 text-center'>
        <Icons.logo className='mx-auto h-6 w-6' />
        <h1 className='text-2xl font-semibold tracking-tight'>{dict.auth.verifyEmail}</h1>
      </div>

      {status === 'loading' && (
        <div className='text-center text-muted-foreground'>
          <p>{dict.auth.verifying}</p>
        </div>
      )}

      {status === 'success' && (
        <div className='bg-green-50 rounded-lg p-6 text-center space-y-3'>
          <p className='text-green-700 text-sm font-medium'>{dict.auth.emailVerified}</p>
          <Link href='/sign-in'>
            <Button size='sm'>{dict.auth.signIn}</Button>
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className='bg-red-50 rounded-lg p-6 text-center space-y-3'>
          <p className='text-red-600 text-sm'>{error}</p>
          <Link href='/'>
            <Button variant='ghost' size='sm'>{dict.user.backHome}</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
