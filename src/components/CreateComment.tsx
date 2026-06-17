'use client'

import { Button } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'
import { CommentRequest } from '@/lib/validators/comment'

import { useCustomToasts } from '@/hooks/use-custom-toasts'
import { useMutation } from '@tanstack/react-query'
import axios, { AxiosError } from 'axios'
import { useRouter } from 'next/navigation'
import { FC, useState } from 'react'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { useDict } from '@/components/I18nProvider'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'
import { useAIWrite } from '@/lib/writing-assistant'
import { Sparkles, Loader2 } from 'lucide-react'

interface CreateCommentProps {
  postId: string
  replyToId?: string
}

const CreateComment: FC<CreateCommentProps> = ({ postId, replyToId }) => {
  const [input, setInput] = useState<string>('')
  const router = useRouter()
  const { loginToast } = useCustomToasts()
  const dict = useDict()

  const { write: aiWriteAction, isLoading: isAIGenerating } = useAIWrite()
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)

  const { mutate: comment, isLoading } = useMutation({
    mutationFn: async ({ postId, text, replyToId }: CommentRequest) => {
      const payload: CommentRequest = { postId, text, replyToId }

      const { data } = await axios.patch(
        `/api/subreddit/post/comment/`,
        payload
      )
      return data
    },

    onError: (err) => {
      if (err instanceof AxiosError) {
        if (err.response?.status === 401) {
          return loginToast()
        }
      }

      return toast({
        title: dict.toast.somethingWentWrong,
        description: dict.toast.commentNotCreated,
        variant: 'destructive',
      })
    },
    onSuccess: (_, variables) => {
      trackEvent(AnalyticsEvent.COMMENT_CREATED, {
        postId: variables.postId,
        replyToId: variables.replyToId || null,
      })
      router.refresh()
      setInput('')
    },
  })

  return (
    <div className='grid w-full gap-1.5'>
      <Label htmlFor='comment'>{dict.user.yourComment}</Label>
      <div className='mt-2'>
        <Textarea
          id='comment'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          placeholder={dict.user.whatAreYourThoughts}
        />

        <div className='mt-2 flex items-center gap-2'>
          {input.length >= 10 && (
            <button
              type='button'
              disabled={isAIGenerating}
              onClick={async () => {
                try {
                  const result = await aiWriteAction({
                    text: input,
                    action: 'expand',
                    style: 'casual',
                  })
                  setAiSuggestion(result)
                } catch {
                  // silently fail
                }
              }}
              className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50'>
              {isAIGenerating ? (
                <Loader2 className='h-3 w-3 animate-spin' />
              ) : (
                <Sparkles className='h-3 w-3' />
              )}
              {dict.user.aiReplySuggestion}
            </button>
          )}
          <div className='flex-1' />
          <Button
            isLoading={isLoading}
            disabled={input.length === 0}
            onClick={() => comment({ postId, text: input, replyToId })}>
            {dict.user.post}
          </Button>
        </div>

        {aiSuggestion && (
          <div className='mt-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3'>
            <p className='text-xs text-zinc-600 mb-2 whitespace-pre-wrap'>{aiSuggestion}</p>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={() => {
                  setInput(aiSuggestion)
                  setAiSuggestion(null)
                }}
                className='text-xs font-medium text-orange-600 hover:text-orange-700'>
                {dict.user.useSuggestion}
              </button>
              <button
                type='button'
                onClick={() => setAiSuggestion(null)}
                className='text-xs text-zinc-400 hover:text-zinc-600'>
                {dict.editor.aiDismiss}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CreateComment
