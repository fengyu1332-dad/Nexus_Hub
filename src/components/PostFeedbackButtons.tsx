'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { cn } from '@/lib/utils'
import { useDict } from '@/components/I18nProvider'
import { useCustomToasts } from '@/hooks/use-custom-toasts'

interface PostFeedbackButtonsProps {
  postId: string
}

export function PostFeedbackButtons({ postId }: PostFeedbackButtonsProps) {
  const dict = useDict()
  const { loginToast } = useCustomToasts()
  const [rating, setRating] = useState<'helpful' | 'not_helpful' | null>(null)
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { mutate: submitFeedback } = useMutation({
    mutationFn: async (data: { rating: string; reason?: string }) => {
      await axios.post('/api/post-feedback', { postId, ...data })
    },
    onMutate: ({ rating: newRating }) => {
      setRating(newRating as 'helpful' | 'not_helpful')
    },
    onSuccess: () => {
      setSubmitted(true)
      setShowReason(false)
    },
    onError: (err: any) => {
      setRating(null)
      if (err?.response?.status === 401) {
        return loginToast()
      }
    },
  })

  if (submitted) {
    return (
      <div className='flex items-center gap-2 text-sm text-zinc-500 mt-3 pt-3 border-t border-zinc-100'>
        <span>{dict.aiFeedback?.thanksForFeedback || 'Thanks for your feedback!'}</span>
      </div>
    )
  }

  return (
    <div className='mt-3 pt-3 border-t border-zinc-100'>
      <div className='flex items-center gap-2'>
        <span className='text-xs text-zinc-400'>
          {dict.aiFeedback?.wasThisHelpful || 'Was this helpful?'}
        </span>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            submitFeedback({ rating: 'helpful' })
          }}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            rating === 'helpful'
              ? 'text-emerald-600 bg-emerald-50'
              : 'text-zinc-400 hover:text-emerald-600 hover:bg-zinc-50'
          )}
          title={dict.aiFeedback?.helpful || 'Helpful'}>
          <ThumbsUp className='h-4 w-4' />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setShowReason(true)
            submitFeedback({ rating: 'not_helpful' })
          }}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            rating === 'not_helpful'
              ? 'text-red-500 bg-red-50'
              : 'text-zinc-400 hover:text-red-500 hover:bg-zinc-50'
          )}
          title={dict.aiFeedback?.notHelpful || 'Not helpful'}>
          <ThumbsDown className='h-4 w-4' />
        </button>
      </div>
      {showReason && (
        <div className='mt-2 flex gap-2' onClick={(e) => e.stopPropagation()}>
          <input
            type='text'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={dict.aiFeedback?.tellUsWhy || 'Tell us why (optional)'}
            className='flex-1 text-xs px-2 py-1 border border-zinc-200 rounded focus:outline-none focus:border-zinc-300'
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitFeedback({ rating: 'not_helpful', reason })
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
