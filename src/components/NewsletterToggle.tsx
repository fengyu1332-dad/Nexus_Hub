'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'
import axios from 'axios'
import { useDict } from '@/components/I18nProvider'

interface NewsletterToggleProps {
  email: string
  initialSubscribed: boolean
}

export function NewsletterToggle({ email, initialSubscribed }: NewsletterToggleProps) {
  const [subscribed, setSubscribed] = useState(initialSubscribed)
  const [loading, setLoading] = useState(false)
  const dict = useDict()

  const toggle = async () => {
    setLoading(true)
    try {
      if (subscribed) {
        await axios.delete('/api/newsletter/subscribe', { data: { email } })
        setSubscribed(false)
        toast({ description: dict.newsletter.unsubscribeSuccess })
      } else {
        await axios.post('/api/newsletter/subscribe', { email })
        setSubscribed(true)
        toast({ description: dict.newsletter.subscribeSuccess })
      }
    } catch {
      toast({
        title: dict.newsletter.operationFailed,
        description: dict.newsletter.retryLater,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='rounded-lg border bg-card text-card-foreground shadow-sm'>
      <div className='p-6 space-y-1'>
        <h3 className='text-2xl font-semibold leading-none tracking-tight'>{dict.newsletter.heading}</h3>
        <p className='text-sm text-muted-foreground'>
          {dict.newsletter.description}
        </p>
      </div>
      <div className='p-6 pt-0'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium'>
              {subscribed ? dict.newsletter.subscribed : dict.newsletter.unsubscribed}
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
            {subscribed ? dict.newsletter.unsubscribeAction : dict.newsletter.subscribeAction}
          </Button>
        </div>
      </div>
    </div>
  )
}
