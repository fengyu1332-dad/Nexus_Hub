'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useDict } from '@/components/I18nProvider'

interface Props {
  emailVerified: boolean
  email: string | null
}

export function SettingsVerification({ emailVerified, email }: Props) {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const dict = useDict()

  if (emailVerified) {
    return (
      <div className='flex items-center gap-2 text-sm text-green-600'>
        <span className='w-2 h-2 rounded-full bg-green-500' />
        {dict.auth.emailVerified}
      </div>
    )
  }

  if (!email) return null

  async function handleResend() {
    setIsLoading(true)
    setSent(false)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      // Note: the verify-email trigger uses register flow, so re-trigger
      // by calling a dedicated resend-verification endpoint
      const verifyRes = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (verifyRes.ok) setSent(true)
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex items-center justify-between text-sm'>
      <span className='text-amber-600 flex items-center gap-2'>
        <span className='w-2 h-2 rounded-full bg-amber-500' />
        {dict.auth.emailNotVerified}
      </span>
      {sent ? (
        <span className='text-green-600 text-xs'>{dict.auth.verificationSent}</span>
      ) : (
        <Button variant='ghost' size='sm' onClick={handleResend} isLoading={isLoading}>
          {dict.auth.resendVerification}
        </Button>
      )}
    </div>
  )
}
