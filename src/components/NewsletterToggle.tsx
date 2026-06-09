'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'
import axios from 'axios'

interface NewsletterToggleProps {
  email: string
  initialSubscribed: boolean
}

export function NewsletterToggle({ email, initialSubscribed }: NewsletterToggleProps) {
  const [subscribed, setSubscribed] = useState(initialSubscribed)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      if (subscribed) {
        await axios.delete('/api/newsletter/subscribe', { data: { email } })
        setSubscribed(false)
        toast({ description: '已退订周报邮件' })
      } else {
        await axios.post('/api/newsletter/subscribe', { email })
        setSubscribed(true)
        toast({ description: '已订阅周报邮件，每周日早上见' })
      }
    } catch {
      toast({
        title: '操作失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='rounded-lg border bg-card text-card-foreground shadow-sm'>
      <div className='p-6 space-y-1'>
        <h3 className='text-2xl font-semibold leading-none tracking-tight'>Newsletter</h3>
        <p className='text-sm text-muted-foreground'>
          每周日早上接收由 AI Architect 汇编的学术周报
        </p>
      </div>
      <div className='p-6 pt-0'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium'>
              {subscribed ? '已订阅' : '未订阅'}
            </p>
            <p className='text-xs text-zinc-500 mt-0.5'>
              {email}
            </p>
          </div>
          <Button
            variant={subscribed ? 'subtle' : 'default'}
            isLoading={loading}
            onClick={toggle}
          >
            {subscribed ? '退订' : '订阅'}
          </Button>
        </div>
      </div>
    </div>
  )
}
