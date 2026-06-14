'use client'
import { Button } from '@/components/ui/Button'
import { SubscribeToSubredditPayload } from '@/lib/validators/subreddit'
import { useMutation } from '@tanstack/react-query'
import axios, { AxiosError } from 'axios'
import { useRouter } from 'next/navigation'
import { startTransition } from 'react'
import { useToast } from '../hooks/use-toast'
import { useCustomToasts } from '@/hooks/use-custom-toasts'
import { useDict } from '@/components/I18nProvider'
import { getDisplayName } from '@/lib/subreddit'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'

interface SubscribeLeaveToggleProps {
  isSubscribed: boolean
  subredditId: string
  subredditName: string
  subredditDisplayName?: string | null
}

const SubscribeLeaveToggle = ({
  isSubscribed,
  subredditId,
  subredditName,
  subredditDisplayName,
}: SubscribeLeaveToggleProps) => {
  const displayName = getDisplayName(subredditName, subredditDisplayName)
  const { toast } = useToast()
  const { loginToast } = useCustomToasts()
  const router = useRouter()
  const dict = useDict()

  const { mutate: subscribe, isLoading: isSubLoading } = useMutation({
    mutationFn: async () => {
      const payload: SubscribeToSubredditPayload = {
        subredditId,
      }

      const { data } = await axios.post('/api/subreddit/subscribe', payload)
      return data as string
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        if (err.response?.status === 401) {
          return loginToast()
        }
      }

      return toast({
        title: dict.toast.thereWasAProblem,
        description: dict.toast.pleaseTryAgain,
        variant: 'destructive',
      })
    },
    onSuccess: () => {
      startTransition(() => {
        router.refresh()
      })
      trackEvent(AnalyticsEvent.COMMUNITY_SUBSCRIBED, { subredditName, subredditId })
      toast({
        title: dict.toast.subscribed,
        description: `${dict.toast.subscribedTo} r/${displayName}`,
      })
    },
  })

  const { mutate: unsubscribe, isLoading: isUnsubLoading } = useMutation({
    mutationFn: async () => {
      const payload: SubscribeToSubredditPayload = {
        subredditId,
      }

      const { data } = await axios.post('/api/subreddit/unsubscribe', payload)
      return data as string
    },
    onError: (err: AxiosError) => {
      toast({
        title: dict.toast.error,
        description: err.response?.data as string,
        variant: 'destructive',
      })
    },
    onSuccess: () => {
      startTransition(() => {
        router.refresh()
      })
      trackEvent(AnalyticsEvent.COMMUNITY_UNSUBSCRIBED, { subredditName, subredditId })
      toast({
        title: dict.toast.unsubscribed,
        description: `${dict.toast.unsubscribedFrom} r/${displayName}`,
      })
    },
  })

  return isSubscribed ? (
    <Button
      className='w-full mt-1 mb-4'
      isLoading={isUnsubLoading}
      onClick={() => unsubscribe()}>
      {dict.user.leaveCommunity}
    </Button>
  ) : (
    <Button
      className='w-full mt-1 mb-4'
      isLoading={isSubLoading}
      onClick={() => subscribe()}>
      {dict.user.joinToPost}
    </Button>
  )
}

export default SubscribeLeaveToggle
