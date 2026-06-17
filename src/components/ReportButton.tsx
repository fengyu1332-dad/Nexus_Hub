'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDict } from '@/components/I18nProvider'
import { useCustomToasts } from '@/hooks/use-custom-toasts'

const REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'] as const

interface Props {
  targetType: 'post' | 'comment'
  targetId: string
}

export function ReportButton({ targetType, targetId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const dict = useDict()
  const d = dict.report
  const { loginToast } = useCustomToasts()

  async function handleSubmit() {
    if (!reason) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, description: description || undefined }),
      })
      if (res.status === 401) {
        loginToast()
        return
      }
      if (res.status === 409) {
        setDone(true)
        return
      }
      if (res.ok) {
        setDone(true)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <button
        className='text-xs text-muted-foreground hover:text-zinc-600 transition-colors'
        title={d.submitted}
      >
        <Flag className='w-4 h-4' />
      </button>
    )
  }

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='text-xs text-muted-foreground hover:text-red-500 transition-colors'
        title={targetType === 'post' ? d.reportPost : d.reportComment}
      >
        <Flag className='w-4 h-4' />
      </button>

      {isOpen && (
        <>
          <div className='fixed inset-0 z-40' onClick={() => setIsOpen(false)} />
          <div className='absolute right-0 top-6 z-50 w-64 rounded-lg border bg-white shadow-lg p-3 space-y-3'>
            <p className='text-sm font-medium'>{d.reason}</p>
            <div className='space-y-1'>
              {REASONS.map((r) => (
                <label key={r} className='flex items-center gap-2 text-sm cursor-pointer'>
                  <input
                    type='radio'
                    name='reason'
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className='text-rose-500'
                  />
                  {d[r]}
                </label>
              ))}
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={d.description}
              className='w-full rounded border border-zinc-200 px-2 py-1 text-xs resize-none'
              rows={2}
              maxLength={500}
            />
            <div className='flex justify-end gap-2'>
              <Button variant='ghost' size='sm' onClick={() => setIsOpen(false)}>
                {dict.user.cancel}
              </Button>
              <Button
                size='sm'
                onClick={handleSubmit}
                isLoading={isLoading}
                disabled={!reason || isLoading}
              >
                {d.submit}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
