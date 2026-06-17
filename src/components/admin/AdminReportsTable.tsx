'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Loader2 } from 'lucide-react'
import { useDict } from '@/components/I18nProvider'

interface Report {
  id: string
  reporterId: string
  reporterUsername: string
  targetType: string
  targetId: string
  reason: string
  description: string | null
  status: string
  createdAt: string
}

interface Props {
  initialReports: Report[]
  initialTotal: number
}

export function AdminReportsTable({ initialReports, initialTotal }: Props) {
  const [reports, setReports] = useState(initialReports)
  const [isLoading, setIsLoading] = useState(false)
  const dict = useDict()
  const d = dict.admin

  async function handleAction(reportId: string, status: 'resolved' | 'dismissed') {
    setIsLoading(true)
    try {
      await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, status }),
      })
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status } : r
        )
      )
    } catch (e) {
      console.error('Failed to update report:', e)
    } finally {
      setIsLoading(false)
    }
  }

  if (!reports || reports.length === 0) {
    return (
      <div className='text-center py-12 text-muted-foreground'>
        <p>{d.noReports}</p>
      </div>
    )
  }

  const pending = reports.filter((r) => r.status === 'pending').length

  return (
    <div>
      <div className='flex items-center gap-3 mb-4'>
        <span className='text-sm text-muted-foreground'>
          {d.pending}: {pending} / {reports.length}
        </span>
      </div>

      <div className='overflow-x-auto'>
        <table className='min-w-full divide-y divide-zinc-200'>
          <thead>
            <tr className='text-left text-xs text-muted-foreground'>
              <th className='py-2 pr-2'>{d.reportedBy}</th>
              <th className='py-2 px-2'>{dict.report.reason}</th>
              <th className='py-2 px-2'>{d.reports}</th>
              <th className='py-2 px-2'>{dict.relativeTime.justNow}</th>
              <th className='py-2 pl-2'>{dict.relativeTime.ago}</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-zinc-100'>
            {reports.map((r) => (
              <tr key={r.id} className='text-sm'>
                <td className='py-2 pr-2 text-zinc-700'>{r.reporterUsername}</td>
                <td className='py-2 px-2'>
                  <span className='inline-block px-2 py-0.5 rounded text-xs bg-zinc-100'>
                    {dict.report[r.reason as keyof typeof dict.report] || r.reason}
                  </span>
                </td>
                <td className='py-2 px-2'>
                  <span className='text-zinc-500'>
                    {r.targetType === 'post' ? d.reportedPost : d.reportedComment}
                  </span>
                  {r.description && (
                    <p className='text-xs text-zinc-400 mt-0.5 line-clamp-1'>{r.description}</p>
                  )}
                </td>
                <td className='py-2 px-2'>
                  {r.status === 'pending' ? (
                    <span className='text-amber-600 text-xs font-medium'>{d.pending}</span>
                  ) : r.status === 'resolved' ? (
                    <span className='text-green-600 text-xs'>{d.resolved}</span>
                  ) : (
                    <span className='text-zinc-400 text-xs'>{d.dismissed}</span>
                  )}
                </td>
                <td className='py-2 pl-2'>
                  {r.status === 'pending' ? (
                    <div className='flex gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs h-7 px-2'
                        onClick={() => handleAction(r.id, 'resolved')}
                        disabled={isLoading}
                      >
                        {d.resolve}
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-xs h-7 px-2 text-zinc-400'
                        onClick={() => handleAction(r.id, 'dismissed')}
                        disabled={isLoading}
                      >
                        {d.dismiss}
                      </Button>
                    </div>
                  ) : (
                    <span className='text-xs text-zinc-400'>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
