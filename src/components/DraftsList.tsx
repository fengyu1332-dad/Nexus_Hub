'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useDict } from '@/components/I18nProvider'
import { Loader2, FileText, Trash2 } from 'lucide-react'

export function DraftsList() {
  const dict = useDict()
  const d = dict.editor

  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['drafts'],
    queryFn: async () => {
      const { data } = await axios.get('/api/posts/drafts')
      return data
    },
  })

  async function handleDelete(postId: string) {
    if (!confirm(d.deleteDraft + '?')) return
    try {
      await axios.delete('/api/posts/drafts', { data: { postId } })
      refetch()
    } catch {
      // ignore
    }
  }

  if (isLoading) {
    return (
      <div className='flex justify-center py-12'>
        <Loader2 className='w-6 h-6 text-zinc-500 animate-spin' />
      </div>
    )
  }

  if (!drafts || drafts.length === 0) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <FileText className='w-12 h-12 mx-auto mb-3 text-zinc-300' />
        <p>{d.noDrafts}</p>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      {drafts.map((draft: any) => (
        <div
          key={draft.id}
          className='flex items-center justify-between rounded-lg border p-4 hover:border-zinc-300 transition-colors'
        >
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-medium truncate'>{draft.title || d.draft}</p>
            <p className='text-xs text-zinc-400'>
              r/{draft.subredditName} · {new Date(draft.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className='flex items-center gap-2 ml-4'>
            <Link href={`/r/${draft.subredditName}/submit?draftId=${draft.id}`}>
              <Button variant='ghost' size='sm' className='text-xs'>
                {d.continueEditing}
              </Button>
            </Link>
            <button
              onClick={() => handleDelete(draft.id)}
              className='p-1.5 text-zinc-400 hover:text-red-500 transition-colors'
              title={d.deleteDraft}
            >
              <Trash2 className='w-4 h-4' />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
