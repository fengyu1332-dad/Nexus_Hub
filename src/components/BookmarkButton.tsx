'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { cn } from '@/lib/utils'
import { useDict } from '@/components/I18nProvider'
import { useCustomToasts } from '@/hooks/use-custom-toasts'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'

interface BookmarkButtonProps {
  postId: string
  initialSaved: boolean
}

const BookmarkButton = ({ postId, initialSaved }: BookmarkButtonProps) => {
  const dict = useDict()
  const { loginToast } = useCustomToasts()
  const [saved, setSaved] = useState(initialSaved)

  const { mutate: toggle } = useMutation({
    mutationFn: async ({ action }: { action: 'save' | 'unsave' }) => {
      await axios.patch('/api/bookmark', { postId })
    },
    onMutate: ({ action }) => {
      setSaved(action === 'save')
    },
    onSuccess: (_, { action }) => {
      trackEvent(
        action === 'save'
          ? AnalyticsEvent.POST_BOOKMARKED
          : AnalyticsEvent.POST_UNBOOKMARKED,
        { postId }
      )
    },
    onError: (err: any, { action }) => {
      setSaved(action !== 'save') // rollback
      if (err?.response?.status === 401) {
        return loginToast()
      }
    },
  })

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({ action: saved ? 'unsave' : 'save' })
      }}
      className='p-1.5 rounded-md hover:bg-zinc-100 transition-colors'
      title={saved ? dict.bookmark.unsave : dict.bookmark.save}>
      <Bookmark
        className={cn(
          'h-5 w-5 transition-colors',
          saved
            ? 'fill-amber-500 text-amber-500'
            : 'text-zinc-400 hover:text-zinc-600'
        )}
      />
    </button>
  )
}

export default BookmarkButton
