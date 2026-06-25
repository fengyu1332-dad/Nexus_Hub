'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import axios from 'axios'
import { useDict } from '@/components/I18nProvider'
import { useCustomToasts } from '@/hooks/use-custom-toasts'
import { formatTimeToNow } from '@/lib/utils'
import { useI18n } from '@/components/I18nProvider'
import Link from 'next/link'
import { useState } from 'react'

interface NotificationItem {
  id: string
  type: string
  fromUserId: string
  postId: string | null
  commentId: string | null
  read: boolean
  createdAt: string
  fromUser: {
    username: string | null
    image: string | null
  }
}

const NotificationBell = () => {
  const dict = useDict()
  const { locale } = useI18n()
  const { loginToast } = useCustomToasts()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const res = await axios.get('/api/notifications')
        return res.data as { notifications: NotificationItem[]; unreadCount: number }
      } catch (err: any) {
        if (err?.response?.status === 401) return null
        throw err
      }
    },
    refetchInterval: 30_000,
  })

  const { mutate: markAllRead } = useMutation({
    mutationFn: async () => {
      await axios.patch('/api/notifications', { all: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications'])
    },
  })

  const unreadCount = data?.unreadCount || 0
  const notifications = data?.notifications || []

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='relative p-2 rounded-md hover:bg-zinc-100 transition-colors'
        title={dict.notifications.title}>
        <Bell className='h-5 w-5 text-zinc-600' />
        {unreadCount > 0 && (
          <span className='absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className='fixed inset-0 z-40'
            onClick={() => setIsOpen(false)}
          />
          <div className='absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-zinc-200 z-50 overflow-hidden'>
            <div className='flex items-center justify-between px-4 py-3 border-b border-zinc-100'>
              <h3 className='font-semibold text-sm'>{dict.notifications.title}</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className='text-xs text-blue-600 hover:text-blue-800 font-medium'>
                  {dict.notifications.markAllRead}
                </button>
              )}
            </div>

            <div className='max-h-96 overflow-y-auto'>
              {notifications.length === 0 ? (
                <p className='text-sm text-zinc-400 text-center py-8'>
                  {dict.notifications.empty}
                </p>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    href={`/r/DevShowcase/post/${n.postId}${n.commentId ? `#c-${n.commentId}` : ''}`}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 ${
                      !n.read ? 'bg-blue-50/50' : ''
                    }`}>
                    <span className='flex-shrink-0 mt-0.5 text-base'>
                      💬
                    </span>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm text-zinc-700'>
                        <span className='font-medium'>
                          {n.fromUser.username || 'User'}
                        </span>{' '}
                        {dict.notifications.commentReply}
                      </p>
                      <p className='text-xs text-zinc-400 mt-0.5'>
                        {formatTimeToNow(n.createdAt, locale)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className='flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500' />
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
