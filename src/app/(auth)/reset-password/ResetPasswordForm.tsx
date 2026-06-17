'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

interface Props {
  labels: {
    passwordPlaceholder: string
    resetPassword: string
    invalidOrExpiredToken: string
    passwordResetSuccess: string
    signIn: string
  }
}

export function ResetPasswordForm({ labels }: Props) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError(labels.invalidOrExpiredToken)
    }
  }, [token, labels.invalidOrExpiredToken])

  if (!token) {
    return (
      <div className='bg-red-50 rounded-lg p-4 text-center'>
        <p className='text-red-600 text-sm'>{error}</p>
        <Link href='/forgot-password' className='text-sm text-rose-500 underline mt-2 inline-block'>
          Request a new reset link
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className='bg-green-50 rounded-lg p-4 text-center space-y-3'>
        <p className='text-green-700 text-sm'>{labels.passwordResetSuccess}</p>
        <Link href='/sign-in'>
          <Button size='sm'>{labels.signIn}</Button>
        </Link>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || labels.invalidOrExpiredToken)
        return
      }
      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className='flex flex-col gap-3'>
      {error && (
        <p className='text-sm text-red-500 text-center bg-red-50 rounded-lg py-2 px-3'>{error}</p>
      )}
      <input
        type='password'
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={labels.passwordPlaceholder}
        className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
        required
        minLength={6}
      />
      <Button isLoading={isLoading} type='submit' size='sm' className='w-full' disabled={isLoading}>
        {labels.resetPassword}
      </Button>
    </form>
  )
}
