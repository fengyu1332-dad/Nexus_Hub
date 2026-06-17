'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  labels: {
    emailPlaceholder: string
    sendResetLink: string
    resetEmailSent: string
  }
}

export function ForgotPasswordForm({ labels }: Props) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (sent) {
    return (
      <div className='bg-green-50 rounded-lg p-4 text-center'>
        <p className='text-green-700 text-sm'>{labels.resetEmailSent}</p>
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok && res.status !== 200) {
        const data = await res.json().catch(() => ({}))
        setError(data.message || 'Failed to send reset link')
        return
      }
      setSent(true)
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
        type='email'
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={labels.emailPlaceholder}
        className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
        required
      />
      <Button isLoading={isLoading} type='submit' size='sm' className='w-full' disabled={isLoading}>
        {labels.sendResetLink}
      </Button>
    </form>
  )
}
